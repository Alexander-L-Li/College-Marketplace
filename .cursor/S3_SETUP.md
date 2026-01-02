# S3 Image Upload Setup Guide

## ✅ What's Been Implemented

The S3 image upload integration is now complete! Here's what was added:

### Backend Changes:

1. **New endpoint**: `POST /s3/upload-urls` - Generates batch presigned upload URLs
2. **Updated endpoint**: `GET /s3/upload-url` - Single image upload URL (renamed from test endpoint)
3. **Updated listings endpoints**: Now generate presigned view URLs from S3 keys when retrieving listings

### Frontend Changes:

1. **Image upload flow**: Images are now uploaded to S3 before form submission
2. **Upload progress**: Shows "Uploading Images..." state during upload
3. **S3 key storage**: Stores S3 keys instead of blob URLs

## 🔧 What You Need to Do

### 1. Set Up AWS S3 Bucket

1. **Create an S3 bucket** (if you haven't already):

   - Go to AWS Console → S3
   - Create a new bucket (e.g., `dorm-space-images-your-unique-id`)
   - Choose a region (e.g., `us-east-1`)
   - **Important**: Uncheck "Block all public access" if you want public read access, OR keep it private and use presigned URLs (current implementation uses presigned URLs)

2. **Configure bucket permissions**:

   - For **public read access** (simpler, but less secure):
     - Go to Bucket → Permissions → Bucket Policy
     - Add policy to allow public read:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "PublicReadGetObject",
           "Effect": "Allow",
           "Principal": "*",
           "Action": "s3:GetObject",
           "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
         }
       ]
     }
     ```
   - For **private bucket with presigned URLs** (more secure, current implementation):
     - Keep bucket private
     - Presigned URLs will be generated automatically (expire after 1 hour)

3. **Create IAM User for API Access**:
   - Go to AWS Console → IAM → Users
   - Create a new user (e.g., `dorm-space-s3-user`)
   - Attach policy: `AmazonS3FullAccess` (or create custom policy with only needed permissions)
   - Create Access Key → Save the Access Key ID and Secret Access Key

### 2. Update Environment Variables

Add these to your `backend/.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=dorm-space-images-your-unique-id
```

**Important**: Make sure your `.env` file is in the `backend/` directory and is NOT committed to git (should be in `.gitignore`).

### 3. Test the Integration

1. **Start your backend server**:

   ```bash
   cd backend
   node index.js
   ```

2. **Start your frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

3. **Test the upload flow**:
   - Log in to your app
   - Go to "Create New Listing"
   - Upload images (drag & drop or click)
   - Click "Proceed to Form" (this will upload images to S3)
   - Fill out the form and submit
   - Check that images appear correctly in the listings

### 4. Verify S3 Uploads

- Go to AWS Console → S3 → Your bucket
- You should see a `listings/` folder with uploaded images
- Images should be named like: `listings/1234567890-filename.jpg`

## 🔍 Troubleshooting

### Error: "Failed to generate upload URL"

- Check that AWS credentials are correct in `.env`
- Verify IAM user has S3 permissions
- Check that bucket name matches `S3_BUCKET_NAME` in `.env`

### Error: "Failed to upload image"

- Check CORS configuration on S3 bucket (if needed)
- Verify presigned URL hasn't expired (they expire after 5 minutes)
- Check browser console for CORS errors

### Images not displaying

- Check that S3 keys are being stored in database correctly
- Verify presigned URLs are being generated (check backend logs)
- If using public bucket, ensure bucket policy allows public read

### Database errors

- Make sure `listing_images` table exists
- Verify `image_url` column can store S3 keys (should be `text` type)
- Check that S3 keys are being sent correctly from frontend

## 📝 How It Works

1. **User uploads images** → Images stored locally with preview URLs
2. **User clicks "Proceed to Form"** → Frontend requests presigned upload URLs from backend
3. **Backend generates presigned URLs** → Returns upload URLs and S3 keys
4. **Frontend uploads directly to S3** → Uses presigned URLs to upload files
5. **Frontend stores S3 keys** → Keeps track of uploaded image keys
6. **User submits form** → Sends listing data + S3 keys to backend
7. **Backend saves to database** → Stores S3 keys in `listing_images` table
8. **When viewing listings** → Backend generates presigned view URLs from stored keys

## 🎯 Next Steps (Optional Improvements)

1. **Make bucket public for reading** (simpler, but less secure):

   - Update bucket policy to allow public read
   - Modify backend to return public URLs instead of presigned URLs
   - Faster, no expiration, but images are publicly accessible

2. **Add image optimization**:

   - Resize images before upload
   - Compress images
   - Generate thumbnails

3. **Add upload progress**:

   - Show individual image upload progress
   - Better UX for large images

4. **Error recovery**:
   - Retry failed uploads
   - Clean up partial uploads on error
