FROM node:20-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 3000

# The command is overridden by docker-compose for dev
CMD ["npm", "run", "dev"]
