FROM rust:1.81 AS builder
WORKDIR /usr/src/core-api
COPY . .

RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y libssl3

COPY --from=builder /usr/src/core-api/target/release/core-api .

EXPOSE 8080
CMD ["./core-api"]
