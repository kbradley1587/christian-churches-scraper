FROM apify/actor-node-playwright-chrome:18
WORKDIR /home/myuser
COPY package*.json ./
RUN npm install --only=prod --quiet
COPY . ./
CMD node main.js
