import { successResponse } from '../utils/apiResponse.js';

export const getMyraaDashboard = async (req, res) => {
  return res.status(200).json(successResponse('Myraa dashboard loaded.', {
    myraa: {
      status: 'isolated',
      message: 'This section is reserved for future Myraa ZIP integration.'
    }
  }));
};
