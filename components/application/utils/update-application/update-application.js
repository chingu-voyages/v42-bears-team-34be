import User from '../../../../schemas/user.js';
import { ApplicationModel } from '../../../../schemas/application.js';
import { ApplicationStatus } from '../../../../schemas/application-status.js';
/**
 *
 * @param {string} userId
 */
async function updateAndReconcileApplications(userId) {
  // 1. Check that the user has a plaid access token and itemId
  // 2. Find all incomplete applications with the user's id
  // 3. Update their status to 'pending'

  const user = await User.findById(userId);
  if (!user) throw new Error(`User with id ${userId} not found`);

  if (!user.plaidItemId || user.plaidItemId === '') return;
  if (!user.plaidAccessToken || user.plaidAccessToken === '') return;

  return ApplicationModel.updateMany(
    {
      requestedBy: userId,
      status: ApplicationStatus.Incomplete,
    },
    { status: ApplicationStatus.Pending }
  );
}

export default updateAndReconcileApplications;