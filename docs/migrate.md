# Home Assistant Add-on Modernization Plan

## Project Overview

This document outlines a comprehensive plan to modernize the Smart Stream Home Assistant add-on from its current implementation to a modern, best-practices architecture.

### Current Architecture
- **Backend**: Node.js with Express.js (legacy version)
- **Frontend**: Jade templating engine with Bootstrap
- **Database**: node-json-db (file-based JSON storage)
- **Streaming**: FFmpeg with ONVIF camera discovery
- **Configuration**: Mix of JSON files and embedded config

### Target Architecture
- **Backend**: Modern Node.js (LTS) with Express.js REST API + TypeScript
- **Frontend**: Vite + React + TypeScript + Tailwind CSS SPA
- **Database**: Home Assistant native configuration and logging
- **Streaming**: Enhanced FFmpeg with improved error handling
- **Configuration**: Standardized JSON configuration files with type validation
- **Code Quality**: ESLint, Prettier, Husky git hooks

---

## Phase 1: Project Setup & Environment Modernization

### 1.1 Node.js & Dependencies Update

**Tasks:**
- [ ] Update `package.json` to use Node.js LTS (20.x)
- [ ] Set up TypeScript configuration for backend
- [ ] Update Express.js from 4.18.2 to latest stable
- [ ] Replace deprecated `body-parser` with built-in Express methods
- [ ] Update `debug` and other core dependencies
- [ ] Remove `jade` and related template dependencies
- [ ] Add modern development tools (ESLint, Prettier, Husky, etc.)

**Files to modify:**
- `hassio-addon-smartstream/package.json`
- `hassio-addon-smartstream/Dockerfile`

**New dependencies to add:**
```json
{
  "express": "^4.18.x",
  "cors": "^2.8.x", 
  "compression": "^1.7.x",
  "zod": "^3.x.x",
  "ws": "^8.x.x"
}
```

**TypeScript & Development dependencies:**
```json
{
  "@types/node": "^20.x.x",
  "@types/express": "^4.x.x",
  "@types/cors": "^2.x.x",
  "@types/compression": "^1.x.x",
  "@types/ws": "^8.x.x",
  "typescript": "^5.x.x",
  "ts-node": "^10.x.x",
  "tsx": "^4.x.x",
  "nodemon": "^3.x.x",
  "@typescript-eslint/eslint-plugin": "^6.x.x",
  "@typescript-eslint/parser": "^6.x.x",
  "eslint": "^8.x.x",
  "prettier": "^3.x.x",
  "husky": "^8.x.x",
  "lint-staged": "^15.x.x"
}
```

### 1.2 Project Structure Reorganization

**Tasks:**
- [ ] Create new directory structure:
  ```
  /
  ├── backend/
  │   ├── src/
  │   │   ├── controllers/
  │   │   ├── services/
  │   │   ├── middleware/
  │   │   ├── routes/
  │   │   ├── types/
  │   │   ├── utils/
  │   │   └── app.ts
  │   ├── config/
  │   ├── package.json
  │   ├── tsconfig.json
  │   ├── .eslintrc.js
  │   └── .prettierrc
  ├── frontend/
  │   ├── src/
  │   │   ├── components/
  │   │   ├── types/
  │   │   ├── hooks/
  │   │   ├── services/
  │   │   └── utils/
  │   ├── public/
  │   ├── package.json
  │   ├── vite.config.ts
  │   ├── tsconfig.json
  │   ├── tailwind.config.js
  │   └── .eslintrc.js
  ├── shared/
  │   ├── types/
  │   │   ├── camera.ts
  │   │   ├── stream.ts
  │   │   └── config.ts
  │   └── constants/
  └── config/
      ├── addon-config.json
      └── default-settings.json
  ```

---

## Phase 2: Backend API Modernization

### 2.1 Express.js Application Structure

**Tasks:**
- [ ] Create modern Express.js app with TypeScript
- [ ] Set up TypeScript configuration and build process
- [ ] Implement proper error handling middleware with types
- [ ] Add basic CORS for frontend-backend communication
- [ ] Create controller-based route organization with types
- [ ] Implement input validation with Zod schemas
- [ ] Add request logging and monitoring
- [ ] Set up simple polling for status updates
- [ ] Document API endpoints with TypeScript interfaces
- [ ] Implement structured error types and responses

**New files to create:**
- `backend/src/app.ts` - Main Express application
- `backend/src/types/express.ts` - Extended Express types
- `backend/src/types/api.ts` - API request/response types
- `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/validation.ts`
- `backend/src/utils/logger.ts`
- `backend/tsconfig.json` - TypeScript configuration

### 2.2 Configuration Management Migration
**Priority**: High | **Estimated Time**: 3-4 hours

**Tasks:**
- [ ] Replace (or extend) node-json-db with HA native configuration
- [ ] Create type-safe configuration service for HA API integration
- [ ] Implement camera configuration management with validation
- [ ] Create logging service using HA logs with structured data
- [ ] Add configuration validation schemas with Zod
- [ ] Define TypeScript interfaces for all config types
- [ ] Add environment variable management with validation

**Current vs New:**
```javascript
// Current (node-json-db)
this.db.push("/cams/192.168.1.100", camData);

// New (HA Config with TypeScript)
await this.haConfig.setCameraConfig(hostname, camData);
```

### 2.3 API Routes Restructuring

**Tasks:**
- [ ] Create RESTful API endpoints
- [ ] Implement proper HTTP status codes
- [ ] Add API versioning (`/api/v1/`)
- [ ] Document API with TypeScript interface definitions
- [ ] Implement rate limiting and throttling

---

## Phase 3: Frontend Development (Vite + React + Tailwind)

### 3.1 Vite Project Setup

**Tasks:**
- [ ] Initialize Vite project with React + TypeScript template
- [ ] Configure Tailwind CSS with TypeScript support
- [ ] Set up development and build scripts
- [ ] Configure proxy for backend API during development
- [ ] Set up TypeScript configuration for React
- [ ] Configure ESLint and Prettier for React + TypeScript
- [ ] Set up path mapping for clean imports


### 3.2 Component Architecture

**Tasks:**
- [ ] Create typed component structure:
  ```
  frontend/src/
  ├── components/
  │   ├── Camera/
  │   │   ├── CameraCard.tsx
  │   │   ├── CameraForm.tsx
  │   │   ├── CameraList.tsx
  │   │   └── types.ts
  │   ├── Stream/
  │   │   ├── StreamStatus.tsx
  │   │   ├── StreamControls.tsx
  │   │   ├── StreamMetrics.tsx
  │   │   └── types.ts
  │   ├── Discovery/
  │   │   ├── CameraDiscovery.tsx
  │   │   └── DiscoveryProgress.tsx
  │   ├── Layout/
  │   │   ├── Header.tsx
  │   │   ├── Sidebar.tsx
  │   │   ├── Layout.tsx
  │   │   └── Navigation.tsx
  │   └── UI/
  │       ├── Button.tsx
  │       ├── Input.tsx
  │       ├── Modal.tsx
  │       ├── Loading.tsx
  │       ├── ErrorBoundary.tsx
  │       ├── Toast.tsx
  │       └── types.ts
  ├── pages/
  │   ├── Dashboard.tsx
  │   ├── Cameras.tsx
  │   ├── Settings.tsx
  │   ├── Logs.tsx
  │   └── NotFound.tsx
  ├── hooks/
  ├── services/
  ├── types/
  └── utils/
  ```
- [ ] Create reusable UI components with proper props typing
- [ ] Add form validation with React Hook Form + Zod
- [ ] Create basic custom hooks for camera and config management
- [ ] Implement simple loading states
- [ ] Add basic error handling

### 3.3 Modern UI Implementation

**Tasks:**
- [ ] Create responsive dashboard with camera grid
- [ ] Add camera configuration forms with validation
- [ ] Create discovery interface for new cameras
- [ ] Implement basic settings page
- [ ] Create simple loading states

**UI Features:**
- Clean card-based camera interface
- Basic responsive design
- Toast notifications for actions
- Simple confirmation dialogs

---

## Phase 4: Advanced Features & Integration

### 4.1 Home Assistant Integration

**Tasks:**
- [ ] Implement HA Supervisor API integration
- [ ] Create HA configuration schema
- [ ] Add HA logging integration
- [ ] Implement HA add-on options
- [ ] Create HA service discovery integration

### 4.2 Enhanced Streaming Features

**Tasks:**
- [ ] Improve FFmpeg error handling and recovery
- [ ] Add basic stream health monitoring

### 4.3 Basic Logging

**Tasks:**
- [ ] Implement basic structured logging
- [ ] Create simple health check endpoint

---

## Phase 5: Modern Development Practices

### 5.1 Basic Code Quality

**Tasks:**
- [ ] Set up basic ESLint configuration
- [ ] Configure Prettier with consistent formatting rules
- [ ] Add TypeScript strict mode configuration
- [ ] Create basic development documentation


### 5.2 Simple Build & Deploy

**Tasks:**
- [ ] Set up basic Docker build process
- [ ] Create simple deployment script
- [ ] Add basic documentation for deployment

### 5.3 Input Validation & Basic Security

**Tasks:**
- [ ] Implement input validation with Zod schemas
- [ ] Add basic error handling for malformed requests
- [ ] Set up simple CORS for frontend-backend communication
- [ ] Add dependency vulnerability scanning (optional)

**Input validation example:**
```typescript
// Camera configuration validation
const cameraSchema = z.object({
  hostname: z.string().min(1).max(253),
  port: z.number().min(1).max(65535),
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
  autostart: z.boolean().optional(),
});

// Simple CORS setup
app.use(cors({
  origin: true, // Allow same-origin requests
  credentials: true,
}));
```

**Why Simplified Security for HA Add-on:**
- HA handles external authentication and access control
- Add-on runs in isolated container environment
- Only accessible within HA's network context
- Focus on data validation rather than access control
