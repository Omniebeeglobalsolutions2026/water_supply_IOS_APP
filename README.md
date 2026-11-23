# BHAGIRA Water Supply System

Comprehensive water supply booking, delivery tracking, and vendor fleet management platform for iOS and Android.

## Project Structure

```
.
├── backend/      # Express.js REST API with MongoDB Atlas & Razorpay integration
└── frontend/     # React Native (Expo SDK 58) cross-platform mobile application
```

## Features

- **Customer App**: Real-time nearby tanker discovery, booking, online Razorpay payments, and live delivery updates.
- **Vendor Portal**: Fleet and tanker management, dynamic pricing, live dispatch radar, and order fulfillment.
- **Adaptive UI**: Automatically handles Android 3-button navigation and gesture navigation safe area insets.
- **Notification Deduplication**: Clean single-notification dispatch per state change (placed, accepted, rejected, completed).

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npx expo start
```
