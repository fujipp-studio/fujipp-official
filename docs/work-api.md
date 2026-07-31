# Work API Contract

## Ownership

- PostgreSQL owns work metadata, translations, positions, technologies, links,
  content sections, publication state, and Cloudinary media metadata.
- Cloudinary owns uploaded work image files.
- Public endpoints expose published work only and do not require
  authentication.
- Admin endpoints require a valid Supabase bearer token and the application
  role `EDITOR` or `ADMIN`.

## Authentication

Public endpoints under `/api/v1/works` do not require an access token.

Admin requests use:

```http
Authorization: Bearer <supabase-access-token>
```

An authenticated account without the `EDITOR` or `ADMIN` role receives
`403 Forbidden`.

## Locales

Supported locale values are:

- `th`
- `en`

Public endpoints default to `th`. Admin translation endpoints require the
locale as a path parameter.

## Public endpoints

### List published work

```http
GET /api/v1/works?locale=th&category=personal-project&featured=true
```

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `locale` | No | `th` or `en`; defaults to `th` |
| `category` | No | Category code |
| `featured` | No | `true` or `false` |

The response is a JSON array ordered by publication and featured ordering.

```json
[
  {
    "slug": "fujipp-official",
    "name": "Fujipp Official",
    "shortDescription": "แพลตฟอร์มส่วนตัวสำหรับนำเสนอผลงาน บริการ และผลิตภัณฑ์ดิจิทัล",
    "status": "ACTIVE",
    "startedOn": "2026-07-01",
    "completedOn": null,
    "featured": true,
    "category": {
      "code": "personal-project",
      "name": "Personal Project"
    },
    "positions": [
      {
        "code": "full-stack-engineer",
        "name": "Full Stack Engineer"
      }
    ],
    "technologies": [
      {
        "slug": "vue-js",
        "name": "Vue.js",
        "iconUrl": null,
        "officialUrl": "https://vuejs.org",
        "group": {
          "code": "frontend",
          "name": "Frontend"
        }
      }
    ],
    "cover": null
  }
]
```

`cover` contains the first gallery image when media exists.

### Get published work by slug

```http
GET /api/v1/works/fujipp-official?locale=en
```

```json
{
  "slug": "fujipp-official",
  "name": "Fujipp Official",
  "shortDescription": "A personal platform for showcasing software work, services, and digital products",
  "overview": "A full-stack personal website that brings together a portfolio, member accounts, and digital services in one platform.",
  "feasibility": "The system uses Vue.js and Spring Boot with Supabase and Cloudinary.",
  "targetUsers": "People exploring software projects and clients seeking development services.",
  "status": "ACTIVE",
  "startedOn": "2026-07-01",
  "completedOn": null,
  "featured": true,
  "publishedAt": "2026-07-30T12:00:00+07:00",
  "category": {
    "code": "personal-project",
    "name": "Personal Project"
  },
  "positions": [],
  "technologies": [],
  "gallery": [],
  "architecture": null,
  "links": [
    {
      "type": "GITHUB",
      "label": "GitHub Repository",
      "url": "https://github.com/fujipp-studio/fujipp-official"
    }
  ],
  "features": [
    {
      "title": "Bilingual portfolio",
      "description": "Presents project listings and details in Thai and English."
    }
  ],
  "challenges": [],
  "learnings": []
}
```

Media objects use this shape:

```json
{
  "url": "https://res.cloudinary.com/example/image/upload/work/image.webp",
  "width": 1600,
  "height": 900,
  "format": "webp",
  "bytes": 245678,
  "altText": "Project dashboard"
}
```

An unknown slug, an unpublished work, or a work without the requested
translation returns `404 Not Found`.

## Admin work endpoints

All endpoints in this section use the base path:

```text
/api/v1/admin/works
```

### List all work

```http
GET /api/v1/admin/works
Authorization: Bearer <supabase-access-token>
```

Returns an array of admin work objects, including drafts and published work.

### Get work by ID

```http
GET /api/v1/admin/works/{id}
Authorization: Bearer <supabase-access-token>
```

### Get work editor catalog

```http
GET /api/v1/admin/works/catalog
Authorization: Bearer <supabase-access-token>
```

Returns active categories, positions, and technologies for editor dropdowns and
multi-select controls. Technology entries include their group code and name.

### Create work

```http
POST /api/v1/admin/works
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "slug": "my-project",
  "categoryCode": "personal-project",
  "status": "IN_PROGRESS",
  "startedOn": "2026-07-01",
  "completedOn": null
}
```

Returns `201 Created`.

### Update work

```http
PUT /api/v1/admin/works/{id}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

The request body has the same fields as create.

The `slug` is limited to 100 characters and `categoryCode` to 50 characters.
Both use lowercase kebab case. `completedOn` cannot be before `startedOn`, and
is required when `status` is `COMPLETED`.

Work status values are:

- `PLANNED`
- `IN_PROGRESS`
- `ACTIVE`
- `COMPLETED`
- `ARCHIVED`

### Upsert a work translation

```http
PUT /api/v1/admin/works/{id}/translations/{locale}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "name": "My Project",
  "shortDescription": "A short project description",
  "overview": "Project overview",
  "feasibility": "Technical approach and feasibility",
  "targetUsers": "The intended users"
}
```

Limits are 100 characters for `name`, 120 for `shortDescription`, and 2,000
each for `overview`, `feasibility`, and `targetUsers`. Every field is required
and must not be blank.

### Replace positions

```http
PUT /api/v1/admin/works/{id}/positions
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "codes": [
    "full-stack-engineer",
    "ux-ui-designer"
  ]
}
```

### Replace technologies

```http
PUT /api/v1/admin/works/{id}/technologies
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "codes": [
    "vue-js",
    "spring-boot",
    "postgresql"
  ]
}
```

The supplied order becomes the display order. Each list accepts at most 50
unique lowercase kebab-case codes.

### Admin work response

Create, update, translation, position, technology, publish, and unpublish
operations return:

```json
{
  "id": "9f56f47d-a017-4bd1-a090-307f1a72dc02",
  "slug": "my-project",
  "categoryCode": "personal-project",
  "categoryName": "Personal Project",
  "status": "IN_PROGRESS",
  "publicationStatus": "DRAFT",
  "startedOn": "2026-07-01",
  "completedOn": null,
  "featured": false,
  "featuredOrder": null,
  "publishedAt": null,
  "createdAt": "2026-07-30T12:00:00+07:00",
  "updatedAt": "2026-07-30T12:00:00+07:00",
  "positions": [
    "full-stack-engineer"
  ],
  "technologies": [
    "vue-js"
  ],
  "translations": [
    {
      "locale": "en",
      "name": "My Project",
      "shortDescription": "A short project description",
      "overview": "Project overview",
      "feasibility": "Technical approach and feasibility",
      "targetUsers": "The intended users"
    }
  ]
}
```

## Admin link endpoints

Link type values are `FIGMA`, `GITHUB`, `WEBSITE`, `YOUTUBE`, `CERTIFICATE`,
`LIVE`, and `OTHER`.

### List links

```http
GET /api/v1/admin/works/{id}/links
Authorization: Bearer <supabase-access-token>
```

### Create a link

```http
POST /api/v1/admin/works/{id}/links
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

### Update a link

```http
PUT /api/v1/admin/works/{id}/links/{linkId}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

Create and update use:

```json
{
  "type": "GITHUB",
  "label": "GitHub Repository",
  "url": "https://github.com/example/project",
  "sortOrder": 1
}
```

The label is limited to 100 characters, the URL must start with `https://`,
and `sortOrder` must be zero or greater.

The response is:

```json
{
  "id": "f98d006d-6ed2-4e91-9e11-1303feb5584b",
  "type": "GITHUB",
  "label": "GitHub Repository",
  "url": "https://github.com/example/project",
  "sortOrder": 1
}
```

### Delete a link

```http
DELETE /api/v1/admin/works/{id}/links/{linkId}
Authorization: Bearer <supabase-access-token>
```

Returns `204 No Content`.

## Admin content endpoints

Content type values are `FEATURE`, `CHALLENGE`, and `LEARNING`.

### List content

```http
GET /api/v1/admin/works/{id}/content
Authorization: Bearer <supabase-access-token>
```

### Create content

```http
POST /api/v1/admin/works/{id}/content
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "type": "FEATURE",
  "sortOrder": 1
}
```

Returns `201 Created`.

### Update content metadata

```http
PUT /api/v1/admin/works/{id}/content/{contentId}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

The body has the same fields as create.

### Upsert a content translation

```http
PUT /api/v1/admin/works/{id}/content/{contentId}/translations/{locale}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "title": "Bilingual portfolio",
  "description": "Presents project listings and details in Thai and English."
}
```

The title is limited to 200 characters and the description to 4,000
characters. Both are required and must not be blank.

Content responses use:

```json
{
  "id": "05eab590-105d-41e1-aa66-ecb7d31e488a",
  "type": "FEATURE",
  "sortOrder": 1,
  "translations": [
    {
      "locale": "en",
      "title": "Bilingual portfolio",
      "description": "Presents project listings and details in Thai and English."
    }
  ]
}
```

### Delete content

```http
DELETE /api/v1/admin/works/{id}/content/{contentId}
Authorization: Bearer <supabase-access-token>
```

Returns `204 No Content`.

## Admin media endpoints

Media type values are `GALLERY` and `ARCHITECTURE`.

### List media

```http
GET /api/v1/admin/works/{id}/media
Authorization: Bearer <supabase-access-token>
```

### Upload media

```http
POST /api/v1/admin/works/{id}/media
Authorization: Bearer <supabase-access-token>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | `GALLERY` or `ARCHITECTURE` |
| `sortOrder` | Yes | Gallery: 1–5; architecture: 1 |
| `altText` | No | Maximum 255 characters |
| `file` | Yes | JPEG, PNG, or WebP |

The default maximum file size is 8 MiB. Gallery media supports at most five
ordered images. A work supports one architecture image.

Returns `201 Created`:

```json
{
  "id": "fcb3c0dd-fc8f-4514-9b19-a9f6c74c696d",
  "type": "GALLERY",
  "url": "https://res.cloudinary.com/example/image/upload/work/image.webp",
  "width": 1600,
  "height": 900,
  "format": "webp",
  "bytes": 245678,
  "altText": "Project dashboard",
  "sortOrder": 1
}
```

### Update media metadata

```http
PUT /api/v1/admin/works/{id}/media/{mediaId}
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "altText": "Updated project dashboard",
  "sortOrder": 2
}
```

`sortOrder` must be greater than zero and still obey the media type ordering
rules.

### Delete media

```http
DELETE /api/v1/admin/works/{id}/media/{mediaId}
Authorization: Bearer <supabase-access-token>
```

The Backend deletes both the database record and its Cloudinary image. Returns
`204 No Content`.

## Publication and deletion

### Publish work

```http
POST /api/v1/admin/works/{id}/publish
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
```

```json
{
  "featured": true,
  "featuredOrder": 1
}
```

`featuredOrder` must be zero or greater when supplied. Publishing validates that
the project has the required translations and valid ordered content.

### Unpublish work

```http
POST /api/v1/admin/works/{id}/unpublish
Authorization: Bearer <supabase-access-token>
```

The work immediately stops appearing in public endpoints.

### Delete work

```http
DELETE /api/v1/admin/works/{id}
Authorization: Bearer <supabase-access-token>
```

Returns `204 No Content`. A published work must be unpublished before
destructive structural changes are made.

## Error format

Errors use `application/problem+json`.

Public work not found:

```json
{
  "type": "about:blank",
  "title": "Work not found",
  "status": 404,
  "detail": "The requested published work does not exist"
}
```

Admin errors use these titles:

| Status | Title | Meaning |
| --- | --- | --- |
| `400` | `Invalid work` | Work-specific validation failed |
| `404` | `Work not found` | Work or nested resource does not exist |
| `409` | `Work conflict` | Duplicate or publication-state conflict |
| `502` | `Media service unavailable` | Cloudinary upload or deletion failed |

Bean validation errors use:

```json
{
  "type": "about:blank",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more request fields are invalid",
  "errors": {
    "slug": "must match \"^[a-z0-9]+(?:-[a-z0-9]+)*$\""
  }
}
```

Protected endpoints can also return `401 Unauthorized`, `403 Forbidden`, or
`429 Too Many Requests` according to the authentication contract.

## Configuration

The Backend reads:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_FOLDER
CLOUDINARY_MAX_FILE_SIZE_BYTES
```

The default Cloudinary folder is `fujipp/work`, and the default maximum upload
size is `8388608` bytes.

Local development can place these values in `backend/.env`. Production must
provide them as environment variables and must never commit Cloudinary API
secrets.

## Tests

Run the complete Backend test suite:

```bash
cd backend
./mvnw test
```

The PostgreSQL repository integration test is opt-in:

```bash
cd backend
WORK_INTEGRATION_TESTS=true \
./mvnw test -Dtest=WorkRepositoryIntegrationTests
```

The Cloudinary integration test is also opt-in and requires valid Cloudinary
environment variables:

```bash
cd backend
CLOUDINARY_INTEGRATION_TESTS=true \
./mvnw test -Dtest=CloudinaryIntegrationTests
```
