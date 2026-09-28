export const authValidator = {
  register: (payload) => ({
    success: Boolean(payload.name && payload.email && payload.password),
    message: 'Registration requires name, email, and password.'
  }),
  login: (payload) => ({
    success: Boolean(payload.email && payload.password),
    message: 'Login requires email and password.'
  })
};
