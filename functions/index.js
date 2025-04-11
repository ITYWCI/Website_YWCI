const {onRequest} = require('firebase-functions/v2/https');
const {onCall} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

exports.adminDeleteUserHttp = onRequest({
  cors: true,
  maxInstances: 10,
}, async (req, res) => {
  try {
    console.log('adminDeleteUserHttp called with body:', JSON.stringify(req.body));
    const {adminEmail, userId} = req.body;
    if (!adminEmail || !userId) {
      console.error('Missing parameters:', {adminEmail: !!adminEmail, userId: !!userId});
      res.status(400).json({
        success: false,
        message: `Missing required parameters. Got: adminEmail=${!!adminEmail}, userId=${!!userId}`,
      });
      return;
    }
    const adminQuery = await admin.firestore()
      .collection('admins')
      .where('email', '==', adminEmail)
      .get();
    if (adminQuery.empty) {
      res.status(403).json({success: false, message: 'Not authorized as admin'});
      return;
    }
    try {
      await admin.auth().deleteUser(userId);
      res.status(200).json({
        success: true,
        message: 'User successfully deleted',
      });
    } catch (deleteError) {
      console.error('Error deleting user:', deleteError);
      res.status(500).json({
        success: false,
        message: deleteError.message,
      });
    }
  } catch (error) {
    console.error('Error in adminDeleteUserHttp:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while processing the request',
    });
  }
});

exports.getAdminToken = onCall({
  maxInstances: 10,
}, async (data, context) => {
  try {
    console.log('getAdminToken called with data:', JSON.stringify(data));
    const {email, password} = data;
    if (!email || !password) {
      console.error('Missing email or password:', {email: !!email, password: !!password});
      throw new Error('Email and password are required');
    }
    const adminQuery = await admin.firestore()
      .collection('admins')
      .where('email', '==', email)
      .get();
    if (adminQuery.empty) {
      throw new Error('Not authorized as admin');
    }
    const adminDoc = adminQuery.docs[0];
    const adminId = adminDoc.id;
    const customToken = await admin.auth().createCustomToken(adminId, {
      admin: true,
    });
    return {token: customToken};
  } catch (error) {
    console.error('Error in getAdminToken:', error);
    throw new Error(error.message || 'Failed to generate admin token');
  }
});

exports.deleteAuthUser = onCall({
  maxInstances: 10,
}, async (data, context) => {
  if (!context.auth) {
    throw new Error('The function must be called while authenticated.');
  }
  try {
    const isAdmin = context.auth.token.admin === true;
    if (!isAdmin) {
      const adminSnapshot = await admin.firestore()
        .collection('admins')
        .doc(context.auth.uid)
        .get();
      if (!adminSnapshot.exists) {
        throw new Error('The caller does not have permission to execute the specified operation.');
      }
    }
    const {uid} = data;
    if (!uid) {
      throw new Error('The function must be called with a valid uid.');
    }
    await admin.auth().deleteUser(uid);
    return {
      success: true,
      message: 'User successfully deleted',
    };
  } catch (error) {
    console.error('Error in deleteAuthUser:', error);
    throw new Error(error.message || 'An error occurred while deleting the user');
  }
});
