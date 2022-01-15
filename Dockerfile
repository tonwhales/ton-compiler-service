FROM node:16

# Dependencies
ENV DEBIAN_FRONTEND=noninteractive 
RUN apt-get update && \
    apt-get install -y \
    wget git python3 python3-pip build-essential make cmake clang \
    libgflags-dev zlib1g-dev libssl-dev libreadline-dev libmicrohttpd-dev pkg-config libgsl-dev

# Build
WORKDIR /usr/src
RUN git clone --recursive https://github.com/newton-blockchain/ton.git
RUN export CC=$(which clang)
RUN export CXX=$(which clang++) 
RUN export CCACHE_DISABLE=1
RUN cmake -DCMAKE_BUILD_TYPE=Release /usr/src/ton
RUN make -j 4 func fift generate-random-id

# App
WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
CMD [ "node", "./dist/index.js" ]