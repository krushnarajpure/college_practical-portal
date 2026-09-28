export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      error: result.error.issues
    });
  }

  req.body = result.data;
  next();
};
