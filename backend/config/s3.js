const AWS = require("aws-sdk");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

// Create S3 instance
const s3 = new AWS.S3();

// Bucket configuration
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "dorm-space-images";

// Generate signed URL for uploading
const generateUploadURL = async (fileName, fileType) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `listings/${Date.now()}-${fileName}`,
    ContentType: fileType,
    Expires: 300, // 5 minutes
  };

  try {
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    return {
      uploadURL,
      key: params.Key,
    };
  } catch (error) {
    console.error("Error generating upload URL:", error);
    throw error;
  }
};

// Generate signed URL for viewing (read-only)
const generateViewURL = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: 3600, // 1 hour
  };

  try {
    return await s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    console.error("Error generating view URL:", error);
    throw error;
  }
};

// Delete image from S3
const deleteImage = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

module.exports = {
  s3,
  BUCKET_NAME,
  generateUploadURL,
  generateViewURL,
  deleteImage,
};
