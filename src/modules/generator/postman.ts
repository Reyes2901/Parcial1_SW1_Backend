// modules/generator/postman.ts
// Generate Postman collection for the generated REST endpoints (§7.9)

import type { UMLModel } from '../../domain/uml-model';
import { toPluralSnakeCase } from './mapper/naming';

export interface PostmanCollection {
  info: {
    name: string;
    schema: string;
  };
  variable?: Array<{
    key: string;
    value: string;
    type?: string;
  }>;
  item: Array<{
    name: string;
    item: Array<{
      name: string;
      request: {
        method: string;
        header: Array<{ key: string; value: string }>;
        body?: {
          mode: string;
          raw: string;
          options?: { raw: { language: string } };
        };
        url: {
          raw: string;
          host: string[];
          path: string[];
        };
      };
    }>;
  }>;
}

export function generatePostmanCollection(model: UMLModel): PostmanCollection {
  const collectionName = `${model.name || 'Spring Boot API'} Collection`;

  const items = model.classes.map((cls) => {
    const resourcePath = toPluralSnakeCase(cls.name).replace(/_/g, '-');
    const rawBaseUrl = `{{baseUrl}}/api/v1/${resourcePath}`;

    const sampleBodyObj: Record<string, unknown> = {};
    for (const attr of cls.attributes) {
      if (attr.isPrimaryKey || attr.name.toLowerCase() === 'id') continue;
      const typeLower = attr.type.toLowerCase();
      if (typeLower.includes('int') || typeLower.includes('long')) {
        sampleBodyObj[attr.name] = 1;
      } else if (typeLower.includes('bigdecimal')) {
        sampleBodyObj[attr.name] = 99.99;
      } else if (typeLower.includes('double') || typeLower.includes('float')) {
        sampleBodyObj[attr.name] = 10.5;
      } else if (typeLower.includes('bool')) {
        sampleBodyObj[attr.name] = true;
      } else if (typeLower.includes('localdatetime')) {
        sampleBodyObj[attr.name] = '2026-09-17T10:00:00';
      } else if (typeLower.includes('localdate') || typeLower.includes('date')) {
        sampleBodyObj[attr.name] = '2026-09-17';
      } else if (typeLower.includes('uuid')) {
        sampleBodyObj[attr.name] = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      } else {
        sampleBodyObj[attr.name] = `Sample ${attr.name}`;
      }
    }

    const sampleBodyJson = JSON.stringify(sampleBodyObj, null, 2);

    return {
      name: cls.name,
      item: [
        {
          name: `Get All ${cls.name}s`,
          request: {
            method: 'GET',
            header: [],
            url: {
              raw: rawBaseUrl,
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', resourcePath],
            },
          },
        },
        {
          name: `Get ${cls.name} by ID`,
          request: {
            method: 'GET',
            header: [],
            url: {
              raw: `${rawBaseUrl}/1`,
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', resourcePath, '1'],
            },
          },
        },
        {
          name: `Create ${cls.name}`,
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: sampleBodyJson,
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: rawBaseUrl,
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', resourcePath],
            },
          },
        },
        {
          name: `Update ${cls.name}`,
          request: {
            method: 'PUT',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: sampleBodyJson,
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: `${rawBaseUrl}/1`,
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', resourcePath, '1'],
            },
          },
        },
        {
          name: `Delete ${cls.name}`,
          request: {
            method: 'DELETE',
            header: [],
            url: {
              raw: `${rawBaseUrl}/1`,
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', resourcePath, '1'],
            },
          },
        },
      ],
    };
  });

  return {
    info: {
      name: collectionName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:8080',
        type: 'string',
      },
    ],
    item: items,
  };
}
