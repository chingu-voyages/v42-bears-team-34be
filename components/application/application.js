// validator
import adminRoute from '../../middleware/adminRoute.js';
import { protectedRoute } from '../../middleware/protectedRoute.js';
import { ApplicationStatus } from '../../schemas/application-status.js';
import { ApplicationModel } from '../../schemas/application.js';
import User from '../../schemas/user.js';
import calculatePaymentSize from './utils/calculate-payment-size/calculate-payment-size.js';

// component level validators
import {
  adminApplicationPatchStatusValidator,
  adminApplicationQueryValidator,
  adminApplicationRejectValidator,
  applicationValidator,
  pageSearchQueryValidator,
  paymentSizeValidator,
  triggerWelcomeEmailValidator,
  userApplicationQueryValidator,
} from './validators.js';

// services

import { emailServiceClient } from '../../services/email-service-client/email-service-client.js';

async function postMakeApplication(req, res, next) {
  // if multiple applications aren't allowed, we check if there's a single Application for user id where status is pending
  // does this need to be a middleware? I don't think so <- answer is no, leaving this here for historic reasons
  const returnExistingApplicationResponse = () => res.status(400).json({
      err: 'User has an application pending review.',
      code: '$PENDING_APPLICATION_EXISTS',
    });
  try {
    if (process.env.ALLOW_MULTIPLE_APPLICATIONS !== 'true') {
      const applications = await ApplicationModel.find({
        requestedBy: req.auth.id,
        status: {
          $in: [ApplicationStatus.Pending, ApplicationStatus.Incomplete],
        },
      }).exec();
      const user = await User.findById(req.auth.id);

      if (user && applications.length > 0) {
        if (
          applications.some(
            (app) => app.status === ApplicationStatus.Incomplete
          )
        ) {
          if (user.plaidItemId && user.plaidAccessToken) {
            // User has already authorized their financial data
            return returnExistingApplicationResponse();
          } 
            return res.status(200).json({
              msg: 'Existing incomplete application',
              id: applications.find(
                (app) => app.status === ApplicationStatus.Incomplete
              ).id,
            });
          
        }
        return returnExistingApplicationResponse();
      }
    }

    const application = await ApplicationModel.create({
      requestedLoanAmount: parseFloat(req.body.requestedLoanAmount),
      numberOfInstallments: parseInt(req.body.numberOfInstallments, 10),
      installmentAmount: parseFloat(req.body.installmentAmount),
      applicantOccupation: req.body.applicantOccupation,
      applicantIncome: parseFloat(req.body.applicantIncome),
      loanPurpose: req.body.loanPurpose,
      requestedBy: req.auth.id,
      status: ApplicationStatus.Incomplete,
    });

    await application.save();

    res.status(200).json({
      msg: 'Application received.',
      id: application.id,
    });
  } catch (e) {
    return next(e);
  }
}

async function getApplicationsForAuthenticatedUser(req, res, next) {
  try {
    const userApplications = await ApplicationModel.find({
      requestedBy: req.auth.id,
    }).exec();
    // there are some details which we cannot provide to the user
    const filteredApplications = userApplications.map((a) => ({
      id: a.id,
      applicantIncome: a.applicantIncome,
      applicantOccupation: a.applicantOccupation,
      requestedLoanAmount: a.requestedLoanAmount,
      numberOfInstallments: a.numberOfInstallments,
      installmentAmount: a.installmentAmount,
      loanPurpose: a.loanPurpose,
      status: a.status,
      statusMessage: a.statusMessage,
      requestedBy: a.requestedBy,
      updatedAt: a.updatedAt,
    }));
    res.status(200).json(filteredApplications);
  } catch (e) {
    return next(e);
  }
}

async function getApplicationById(req, res, next) {
  try {
    // find application by id and user
    const criteria = {
      _id: req.params.id,
    };

    // admin can bypass the application ownership
    if (req.auth.role !== 'admin') {
      criteria.requestedBy = req.auth.id;
    }

    const a = await ApplicationModel.findOne(criteria).exec();
    if (!a) {
      return res
        .status(404)
        .send({ err: 'No such application for the current user.' });
    }

    // we don't let the user see very single detail.
    const result = {
      applicantIncome: a.applicantIncome,
      requestedLoanAmount: a.requestedLoanAmount,
      numberOfInstallments: a.numberOfInstallments,
      installmentAmount: a.installmentAmount,
      applicantOccupation: a.applicantOccupation,
      loanPurpose: a.loanPurpose,
      status: a.status,
      statusMessage: a.statusMessage,
      requestedAt: a.createdAt,
      requestedBy: a.requestedBy,
      updatedAt: a.updatedAt,
    };

    if (a.status === ApplicationStatus.Rejected) {
      result.rejectedReason = a.rejectedReason;
    }

    return res.status(200).json(result);
  } catch (e) {
    return next(e);
  }
}

/**
 * Cancels an application. User initiated.
 * When this happens, we need to give the user a "cooldown period" before he/she can apply again.
 */
async function postCancelApplication(req, res, next) {
  try {
    // find application by id and user
    const criteria = {
      _id: req.params.id,
      status: ApplicationStatus.Pending,
    };

    // admin can bypass the application ownership
    if (req.auth.role !== 'admin') {
      criteria.requestedBy = req.auth.id;
    }

    const application = await ApplicationModel.findOne(criteria).exec();
    if (!application) {
      return res.status(404).json({
        err: 'No pending application with that id for the current user.',
      });
    }

    // change status to cancelled.
    application.status = ApplicationStatus.Cancelled;
    await application.save();

    return res.status(200).json({
      msg: 'Application cancelled successfully.',
    });

    // TODO: notify the system there was a cancellation
  } catch (e) {
    return next(e);
  }
}

async function adminGetAllApplications(req, res) {
  try {
    const { page, count } = req.query;
    const applications = await ApplicationModel.find({}, null, {
      limit: count,
      skip: page * count,
    }).exec();

    const mapped = applications.map((app) => ({
      id: app._id.toString(),
      requestedLoanAmount: app.requestedLoanAmount,
      loanPurpose: app.loanPurpose,
      numberOfInstallments: app.numberOfInstallments,
      installmentAmount: app.installmentAmount,
      applicantIncome: app.applicantIncome,
      applicantOccupation: app.applicantOccupation,
      status: app.status,
      statusMessage: app.statusMessage,
      requestedBy: app.requestedBy.toString(),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));

    res.status(200).json({
      applications: mapped,
    });
  } catch (e) {
    return res.status(500).send({ err: e });
  }
}

async function adminGetApplicationCount(req, res) {
  // Simply return total application count for admin
  try {
    const count = await ApplicationModel.count();
    return res.status(200).json(count);
  } catch (e) {
    return res.status(500).send({ err: e });
  }
}

async function adminPatchApproveApplication(req, res, next) {
  try {
    const { id } = req.params;

    const app = await ApplicationModel.findById(id);
    if (!app)
      return res
        .status(404)
        .send({ err: `application with id ${id} not found` });
    app.status = ApplicationStatus.Approved;
    app.evaluatedBy = req.auth.id;

    await app.save();
    res.status(201).json({
      msg: `Approving application ${req.params.id}`,
      id,
    });
  } catch (e) {
    next(e);
  }
}

async function adminPatchRejectApplication(req, res, next) {
  try {
    const { reason } = req.body;
    const { id } = req.params;
    // Find the application and set the rejection status and reason
    const app = await ApplicationModel.findById(id).exec();

    if (!app)
      return res
        .status(404)
        .json({ err: `application with id ${id} not found` });

    app.status = ApplicationStatus.Rejected;
    app.rejectedReason = reason;
    app.evaluatedBy = req.auth.id;

    await app.save();
    res.status(201).json({
      msg: `Rejecting application ${id}`,
      reason,
      id,
    });
  } catch (e) {
    return next(e);
  }
}

async function getPaymentSize(req, res) {
  // This method calculates the payment sizes based on the requested loan amount from 2 -> 12 and returns values
  const { requestedLoanAmount } = req.query;
  const paymentValues = calculatePaymentSize(requestedLoanAmount);
  return res.status(200).send(paymentValues);
}

async function adminPatchApplicationStatus(req, res, next) {
  // Set some other status for example, incomplete or request more information
  try {
    const { action, message } = req.body;
    const { id } = req.params;
    // Find the application and set the special status
    const app = await ApplicationModel.findById(id);
    if (!app)
      return res
        .status(404)
        .json({ err: `application with id ${id} not found` });

    switch (action) {
      case 'mark_more_info_required':
        app.status = ApplicationStatus.MoreInfoRequired;
        app.statusMessage = message;
        await app.save();
        return res.status(201).json({
          msg: `Application status updated`,
          id,
        });
      case 'mark_incomplete':
        app.status = ApplicationStatus.Incomplete;
        app.statusMessage = message;
        await app.save();
        return res.status(201).json({
          msg: `Application status updated`,
          id,
        });
      case 'update_reject_reason':
        app.status = ApplicationStatus.Rejected;
        app.rejectedReason = message;
        await app.save();
        return res.status(201).json({
          msg: `Application status updated`,
          id,
        });
      case 'admin_cancel':
        // Admin initiated cancellation of an application
        app.status = ApplicationStatus.Cancelled;
        // Do we need a reason?
        await app.save();
        return res.status(201).json({
          msg: `Application status updated: cancelled`,
          id,
        });
      default:
        return res.status(400).json({
          err: 'Invalid request',
        });
    }
  } catch (e) {
    return next(e);
  }
}

async function patchApplicationById(req, res, next) {
  const { id } = req.params;
  const {
    requestedLoanAmount,
    numberOfInstallments,
    installmentAmount,
    loanPurpose,
    applicantOccupation,
    applicantIncome,
  } = req.body;

  try {
    // Find the application and make sure that the requestedBy matches
    const app = await ApplicationModel.findById(id);
    if (!app)
      return res.status(404).json({ err: `Cannot find application ${id}` });

    // Only admins can access and users accessing their own application
    if (req.auth.role !== 'admin') {
      if (app.requestedBy.toString() !== req.auth.id)
        return res.status(401).json({
          err: 'This operation is not allowed.',
        });
    }

    // Patch the contents of this app
    app.requestedLoanAmount = requestedLoanAmount;
    app.numberOfInstallments = numberOfInstallments;
    app.installmentAmount = installmentAmount;
    app.loanPurpose = loanPurpose;
    app.applicantOccupation = applicantOccupation;
    app.applicantIncome = applicantIncome;

    await app.save();
    return res.status(201).json({
      msg: `Application with id ${id} was patched`,
    });
  } catch (e) {
    return next(e);
  }
}

async function triggerWelcomeEmail(req, res) {
  // Send the welcome e-mail
  const { itemId, email, applicationId } = req.body;
  try {
    // Find a user with the itemId and email
    const user = await User.findOne({ email, plaidItemId: itemId }).exec();
    if (!user)
      return res.status(404).send({
        err: `user with email ${email} and plaidItemId: ${itemId} not found`,
      });
    const name = `${user.firstName} ${user.lastName}`;
    const recipient = user.email;
    await emailServiceClient.sendEmail('/welcome-email', {
      name,
      recipient,
      applicationId,
      adminEmail: process.env.ADMIN_EMAIL,
    });
    return res.status(200).send({ msg: 'OK' });
  } catch (err) {
    return res.status(500).send({
      err,
    });
  }
}

export default function (app) {
  // user procedures
  app.post('/application/apply', applicationValidator, postMakeApplication);
  app.post(
    '/application/cancel/:id',
    userApplicationQueryValidator,
    postCancelApplication
  );
  app.get(
    '/application/view/:id',
    userApplicationQueryValidator,
    getApplicationById
  );
  app.get(
    '/application/my',
    protectedRoute,
    getApplicationsForAuthenticatedUser
  );
  app.patch(
    '/application/update/:id',
    userApplicationQueryValidator,
    applicationValidator,
    patchApplicationById
  );

  // Trigger welcome e-mail. This relies on info sen
  app.post(
    '/application/trigger-welcome-email',
    triggerWelcomeEmailValidator,
    triggerWelcomeEmail
  );

  // A route that gets the payment size via a query
  app.get('/application/payment_size', paymentSizeValidator, getPaymentSize);

  // administrative procedures
  app.get(
    '/admin/application/all',
    adminRoute,
    pageSearchQueryValidator,
    adminGetAllApplications
  );
  app.get('/admin/application/count', adminRoute, adminGetApplicationCount);
  app.patch(
    '/admin/application/approve/:id',
    adminApplicationQueryValidator,
    adminPatchApproveApplication
  );
  app.patch(
    '/admin/application/reject/:id',
    adminApplicationQueryValidator,
    adminApplicationRejectValidator,
    adminPatchRejectApplication
  );

  // We can use this route to handle setting the application status / message to some other state other than approve / reject
  app.patch(
    '/admin/application/update/:id',
    adminApplicationQueryValidator,
    adminApplicationPatchStatusValidator,
    adminPatchApplicationStatus
  );
  console.log('Application component registered.');
}
