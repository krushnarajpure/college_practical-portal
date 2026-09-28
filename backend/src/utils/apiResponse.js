export const successResponse = (message, data = {}, statusCode = 200) => ({
  success: true,
  message,
  data,
  statusCode
});

export const errorResponse = (message, error = '', statusCode = 500) => ({
  success: false,
  message,
  error,
  statusCode
});
