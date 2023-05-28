import { ApplicationModel } from '../../../schemas/application';
import { ApplicationStatus } from '../../../schemas/application-status';

/**
 * Test helper to create a mockApplication used for testing
 * @param {*} user mongo user document
 * @param {{ requestedLoanAmount?: number,
 * numberOfInstallments?: number,
 * } }
 */
export async function createMockApplication(user, data) {
  const mockApplication = {
    requestedLoanAmount: data?.requestedLoanAmount ?? 1000,
    numberOfInstallments: data?.numberOfInstallments ?? 12,
    installmentAmount: data?.installmentAmount ?? 100,
    applicantOccupation: data?.applicantOccupation ?? 'entrepreneur',
    applicantIncome: data?.applicantIncome ?? 6000,
    loanPurpose: data?.loanPurpose ?? 'bills',
    requestedBy: user._id,
    status: ApplicationStatus.Pending,
  };
  return ApplicationModel.create(mockApplication);
}

export const APP_POST_DATA = {
  requestedLoanAmount: 1000,
  numberOfInstallments: 12,
  installmentAmount: 100,
  applicantOccupation: 'entrepreneur',
  applicantIncome: 6000,
  loanPurpose: 'bills',
};
