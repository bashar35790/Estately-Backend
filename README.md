# Estately - Backend

A robust Express.js backend server for the Estately property rental platform. This API handles all server-side operations including property management, booking processing, authentication, payment integration, and data persistence using MongoDB.

## Project Purpose

The Estately backend provides RESTful API endpoints to support the frontend application. It manages core business logic for property listings, user bookings, payment processing through Stripe, user reviews, favorites, and administrative functions.

## Live URL

[https://estately-api.vercel.app](https://estately-api.vercel.app) *(Replace with your actual live URL)*

## Key Features

- **Express.js Server**: Lightweight and flexible Node.js web application framework
- **MongoDB Database**: NoSQL database for storing properties, bookings, users, reviews, and favorites
- **CORS Support**: Cross-Origin Resource Sharing enabled for frontend communication
- **Stripe Integration**: Payment processing for secure transactions
- **RESTful API Endpoints**:
  - Property management (CRUD operations)
  - Booking management and tracking
  - User management and authentication
  - Payment and checkout processing
  - Review and rating system
  - Favorites management
  - Admin operations
- **Environment Configuration**: Secure environment variable management with dotenv
- **Error Handling**: Comprehensive error handling and validation
- **MongoDB Collections**:
  - Properties: Store property information and details
  - Bookings: Track property reservations and bookings
  - Reviews: Store user reviews and ratings
  - Favorites: Manage user's favorite properties
  - Users: Store user account information

## NPM Packages Used

### Core Dependencies
- **express** (5.2.1): Fast, unopinionated web framework for Node.js
- **mongodb** (7.3.0): Official MongoDB driver for Node.js
- **stripe** (22.3.0): Stripe API client for payment processing
- **cors** (2.8.6): Middleware to enable Cross-Origin Resource Sharing
- **dotenv** (17.4.2): Loads environment variables from `.env` file

### Dev Dependencies
- **nodemon** (3.1.14): Automatically restarts the server during development

## Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm package manager
- MongoDB Atlas account or local MongoDB instance
- Stripe account for payment integration

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory with required environment variables:
```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
STRIPE_SECRET_KEY=your_stripe_secret_key
BETTER_AUTH_URL=http://localhost:3000
```

### Running the Server

**Development Mode** (with hot-reload using nodemon):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

The server will run on the port specified in your `.env` file (default: 5000).

## API Endpoints

### Properties
- `GET /api/properties` - Get all properties
- `GET /api/properties/:id` - Get property by ID
- `POST /api/properties` - Create a new property
- `PUT /api/properties/:id` - Update a property
- `DELETE /api/properties/:id` - Delete a property

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create a new booking
- `PUT /api/bookings/:id` - Update a booking
- `DELETE /api/bookings/:id` - Cancel a booking

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile

### Reviews
- `GET /api/reviews` - Get all reviews
- `POST /api/reviews` - Create a new review
- `GET /api/reviews/property/:propertyId` - Get reviews for a property

### Favorites
- `GET /api/favorites` - Get user's favorite properties
- `POST /api/favorites/:propertyId` - Add property to favorites
- `DELETE /api/favorites/:propertyId` - Remove property from favorites

### Payments
- `POST /api/checkout_sessions` - Create Stripe checkout session
- `POST /api/booking_checkout` - Process booking payment

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `GET /api/admin/properties` - Get all properties (admin only)
- `GET /api/admin/transactions` - Get all transactions (admin only)

## Database Schema

### Properties Collection
```json
{
  "_id": "ObjectId",
  "title": "string",
  "description": "string",
  "location": "string",
  "price": "number",
  "amenities": ["string"],
  "images": ["string"],
  "owner": "ObjectId",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Bookings Collection
```json
{
  "_id": "ObjectId",
  "propertyId": "ObjectId",
  "userId": "ObjectId",
  "checkInDate": "Date",
  "checkOutDate": "Date",
  "totalPrice": "number",
  "status": "string",
  "createdAt": "Date"
}
```

### Users Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "role": "string",
  "createdAt": "Date"
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb+srv://user:password@cluster.mongodb.net/dbname |
| `STRIPE_SECRET_KEY` | Stripe API secret key | sk_test_... |
| `BETTER_AUTH_URL` | Frontend URL for CORS | http://localhost:3000 |

## Security Considerations

- Always keep your `.env` file secure and never commit it to version control
- Use environment variables for all sensitive data (API keys, database credentials)
- Implement proper authentication and authorization checks
- Validate and sanitize all user inputs
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Use Stripe in test mode during development

## Deployment

This project is optimized for deployment on platforms like:
- **Vercel**: Supports Node.js serverless functions
- **Railway**: Simple Node.js deployment
- **Render**: Node.js hosting with PostgreSQL/MongoDB
- **Heroku**: Traditional Node.js hosting

For deployment, ensure all environment variables are properly configured on your hosting platform.

## Learn More

- [Express.js Documentation](https://expressjs.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## License

ISC

## Support

For issues, feature requests, or questions, please contact the development team or open an issue in the repository.