import { defineRoute } from '@lambda-event-router/s3';

// Handle S3 ObjectCreated events with bucket and key filters
export const objectCreatedRoute = defineRoute({
  filters: {
    eventNames: ['s3:ObjectCreated:*'],
    buckets: ['my-uploads-bucket'],
    prefixes: ['uploads/'],
    suffixes: ['.json'],
  },
}).handle(async ({ bucket, key, objectSize, eventName }) => {
  console.log(`Object created: ${key} in ${bucket}`);
  console.log(`Event: ${eventName}, Size: ${objectSize} bytes`);
});

// Handle only PUT events for image uploads (multiple prefixes and suffixes)
export const objectCreatedPutImageRoute = defineRoute({
  filters: {
    eventNames: ['s3:ObjectCreated:Put'],
    buckets: ['my-images-bucket'],
    prefixes: ['images/', 'photos/'],
    suffixes: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Image uploaded: ${key} in ${bucket} (${objectSize} bytes)`);
});

// Handle PUT events for files containing 'thumbnail' in the key
export const objectCreatedThumbnailRoute = defineRoute({
  filters: {
    eventNames: ['s3:ObjectCreated:Put'],
    buckets: ['my-images-bucket'],
    includes: ['thumbnail', 'thumb'],
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Thumbnail created: ${key} in ${bucket} (${objectSize} bytes)`);
});
