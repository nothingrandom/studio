import { defineCollection , z } from 'astro:content';

import { glob, file } from 'astro/loaders';

const profiles = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/profiles',
  }),
  schema: z.object({
    profileImage: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    external_link: z.string(),
  })
});

export const collections = { profiles };
