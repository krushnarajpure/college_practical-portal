import { successResponse } from '../utils/apiResponse.js';

export const analyzePdfWithAi = async (req, res) => {
  return res.status(200).json(successResponse('AI analysis completed for the PDF.', {
    title: 'Generated Practical Title',
    aim: 'AI generated aim based on the uploaded PDF content.',
    about: 'AI generated practical overview.',
    objectives: ['Objective 1', 'Objective 2'],
    requirements: ['Requirement 1', 'Requirement 2'],
    theory: 'Student-friendly explanation of the practical concept.',
    procedure: ['Step 1', 'Step 2'],
    task: 'Perform the required activity and verify the expected result.',
    expectedOutput: 'The required output is observed after following the steps.',
    importantPoints: ['Important point 1'],
    commonErrors: ['Common error 1'],
    vivaQuestions: ['What is the purpose of this practical?']
  }));
};
