import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import Note from '../models/Note.js';
import NotePayment from '../models/NotePayment.js';
import { env } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const gatewayConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret);
const sameSignature = (expected, actual) => {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(String(actual || ''));
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
};

async function razorpayRequest(path, options = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.description || 'Razorpay could not process this payment request.');
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return payload;
}

async function markPaymentCaptured(payment) {
  if (!payment?.order_id || !payment?.id || payment.status !== 'captured') return null;
  const purchase = await NotePayment.findOne({
    razorpayOrderId: payment.order_id,
    amountPaise: payment.amount,
    currency: payment.currency,
    status: { $ne: 'captured' }
  });
  if (!purchase) {
    return NotePayment.findOne({ razorpayOrderId: payment.order_id, status: 'captured' });
  }
  purchase.razorpayPaymentId = payment.id;
  purchase.status = 'captured';
  purchase.capturedAt = new Date();
  await purchase.save();
  return purchase;
}

export const createNotePaymentOrder = async (req, res, next) => {
  try {
    if (!gatewayConfigured()) return res.status(503).json(errorResponse('Online payments are not configured yet. Please contact the administrator.', 'PaymentUnavailable', 503));
    if (!mongoose.Types.ObjectId.isValid(req.body?.noteId)) return res.status(400).json(errorResponse('A valid noteId is required.', 'Bad Request', 400));
    const note = await Note.findOne({
      _id: req.body.noteId,
      isActive: true,
      isDeleted: { $ne: true },
      isPublic: true
    }).select('title customTitle accessType pricePaise storageType');
    if (!note) return res.status(404).json(errorResponse('This note is not available for purchase.', 'Not Found', 404));
    if (note.accessType !== 'paid' || !Number.isSafeInteger(note.pricePaise) || note.pricePaise < 100) {
      return res.status(400).json(errorResponse('This note is not configured as a paid note.', 'Bad Request', 400));
    }
    if (note.storageType === 'driveLink') return res.status(400).json(errorResponse('Google Drive links cannot be sold securely. Upload or create the note in the portal first.', 'Bad Request', 400));

    const existingPurchase = await NotePayment.findOne({ studentId: req.user.id, noteId: note._id, status: 'captured' }).select('_id');
    if (existingPurchase) return res.status(200).json(successResponse('You already have access to this note.', { alreadyOwned: true }));

    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: note.pricePaise,
        currency: 'INR',
        receipt: `note-${randomUUID().replaceAll('-', '')}`,
        notes: { noteId: String(note._id), studentId: String(req.user.id) }
      })
    });
    await NotePayment.create({
      studentId: req.user.id,
      noteId: note._id,
      razorpayOrderId: order.id,
      amountPaise: note.pricePaise,
      currency: 'INR',
      status: 'pending'
    });
    return res.status(201).json(successResponse('Payment order created.', {
      alreadyOwned: false,
      keyId: env.razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      noteTitle: note.customTitle || note.title
    }));
  } catch (error) {
    next(error);
  }
};

export const verifyNotePayment = async (req, res, next) => {
  try {
    if (!gatewayConfigured()) return res.status(503).json(errorResponse('Online payments are not configured yet.', 'PaymentUnavailable', 503));
    const { orderId, paymentId, signature } = req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json(errorResponse('The payment order, payment id and signature are required.', 'Bad Request', 400));
    }
    const purchase = await NotePayment.findOne({ razorpayOrderId: orderId, studentId: req.user.id });
    if (!purchase) return res.status(404).json(errorResponse('Payment order not found for this account.', 'Not Found', 404));
    if (purchase.status === 'captured' && purchase.razorpayPaymentId === paymentId) {
      return res.status(200).json(successResponse('Payment already verified. Note access is active.', { hasAccess: true, noteId: String(purchase.noteId) }));
    }
    const expectedSignature = createHmac('sha256', env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!sameSignature(expectedSignature, signature)) return res.status(400).json(errorResponse('Payment verification failed.', 'InvalidPaymentSignature', 400));

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId || payment.amount !== purchase.amountPaise || payment.currency !== purchase.currency) {
      return res.status(400).json(errorResponse('Payment details do not match this note order.', 'PaymentMismatch', 400));
    }
    if (payment.status !== 'captured') {
      return res.status(409).json(errorResponse('Payment has not been captured yet. Please wait a moment and check again.', 'PaymentNotCaptured', 409));
    }
    const captured = await markPaymentCaptured(payment);
    if (!captured || String(captured.studentId) !== String(req.user.id)) {
      return res.status(409).json(errorResponse('Payment was received but note access could not be confirmed. Please contact support.', 'EntitlementNotConfirmed', 409));
    }
    return res.status(200).json(successResponse('Payment verified. Note access is active now.', { hasAccess: true, noteId: String(captured.noteId) }));
  } catch (error) {
    next(error);
  }
};

export const razorpayNotePaymentWebhook = async (req, res, next) => {
  try {
    if (!env.razorpayWebhookSecret) return res.status(503).json(errorResponse('Payment webhook is not configured.', 'PaymentUnavailable', 503));
    if (!Buffer.isBuffer(req.body)) return res.status(400).json(errorResponse('Raw webhook payload is required.', 'Bad Request', 400));
    const signature = req.get('x-razorpay-signature');
    const expectedSignature = createHmac('sha256', env.razorpayWebhookSecret).update(req.body).digest('hex');
    if (!sameSignature(expectedSignature, signature)) return res.status(400).json(errorResponse('Invalid payment webhook signature.', 'InvalidWebhookSignature', 400));

    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured') {
      await markPaymentCaptured(event.payload?.payment?.entity);
    }
    return res.status(200).json(successResponse('Webhook received.', {}));
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json(errorResponse('Invalid webhook JSON.', 'Bad Request', 400));
    next(error);
  }
};
