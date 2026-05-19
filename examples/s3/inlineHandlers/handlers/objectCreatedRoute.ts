import { defineRoute, type S3FilterInput } from '@lambda-event-router/s3';

// Handle S3 ObjectCreated events with bucket and key filters
export const objectCreatedRoute = defineRoute({
  filters: {
    eventName: 'ObjectCreated:*',
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
}).handle(async ({ bucket, key, objectSize, eventName }) => {
  console.log(`Object created: ${key} in ${bucket}`);
  console.log(`Event: ${eventName}, Size: ${objectSize} bytes`);
});

// Handle only PUT events for image uploads (multiple prefixes and suffixes)
export const objectCreatedPutImageRoute = defineRoute({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: 'my-images-bucket',
    key: ['images/*', 'photos/*', '*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp'],
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Image uploaded: ${key} in ${bucket} (${objectSize} bytes)`);
});

// Handle PUT events for files containing 'thumbnail' in the key
export const objectCreatedThumbnailRoute = defineRoute({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: 'my-images-bucket',
    key: ['*thumbnail*', '*thumb*'],
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Thumbnail created: ${key} in ${bucket} (${objectSize} bytes)`);
});

const LARGE_FILE_THRESHOLD_BYTES = 100 * 1024 * 1024;

// Match large file uploads using custom filter on object size
export const largeFileUploadRoute = defineRoute({
  filters: {
    eventName: 'ObjectCreated:*',
    bucket: 'my-uploads-bucket',
    custom: ({ record }: S3FilterInput) => {
      const objectSize = record.s3.object.size;
      return objectSize >= LARGE_FILE_THRESHOLD_BYTES;
    },
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Large file uploaded: ${key} in ${bucket} (${objectSize} bytes)`);
});
