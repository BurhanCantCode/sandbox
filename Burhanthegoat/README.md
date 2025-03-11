# LinuxFtE2B

This project is a Next.js application that integrates with the E2B code interpreter to provide a terminal interface with AI assistance.

## Features

- Terminal interface with command execution
- AI chat assistant
- Light and dark theme support
- Responsive design for mobile and desktop

## Getting Started

### Prerequisites

- Node.js and npm installed
- E2B API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/BurhanCantCode/LinuxFtE2B.git
   ```

2. Navigate to the project directory:
   ```bash
   cd LinuxFtE2B
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add your E2B API key:
     ```
     NEXT_PUBLIC_E2B_API_KEY=your_api_key_here
     ```

### Running the Application

To start the development server, run:
```bash
npm run dev
```

### Building for Production

To create an optimized production build, run:
```bash
npm run build
```

### Deployment

This project is ready to be deployed on Vercel. Ensure all environment variables are set in the Vercel dashboard.

## License

This project is licensed under the MIT License. 