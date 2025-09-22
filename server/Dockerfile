# Use a Rust base image with Cargo installed
FROM rust:1.89.0 AS builder
RUN apt-get update && apt-get install -y libdbus-1-dev pkg-config libudev-dev && rm -rf /var/lib/apt/lists/*
# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the Cargo.toml and Cargo.lock files
COPY ./ ./

# Build your application
RUN cargo build --release

# Start a new stage to create a smaller image without unnecessary build dependencies
FROM debian:13.1-slim
WORKDIR /opt/app
COPY --from=builder /usr/src/app/target/release/server ./server

RUN apt-get update && apt-get install  -y libssl-dev ca-certificates pkg-config curl netcat-openbsd openssl libdbus-1-dev pkg-config libudev-dev \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY ./crt ./crt
RUN chmod +x ./server

EXPOSE 4444

CMD ["./server", "-a", "0.0.0.0:4444"] 