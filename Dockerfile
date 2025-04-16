FROM erlang:27.1.1.0-alpine AS build
COPY --from=ghcr.io/gleam-lang/gleam:v1.10.0-erlang-alpine /bin/gleam /bin/gleam

# Add project code
COPY ./client /build/client
COPY ./shared /build/shared
COPY ./server /build/server

RUN cd /build/client && gleam run -m lustre/dev build app

RUN mkdir -p /build/server/priv/static
RUN cp /build/client/priv/static/* /build/server/priv/static/

# Compile the project
RUN cd /build/server && gleam export erlang-shipment

FROM erlang:27.1.1.0-alpine
RUN \
  addgroup --system webapp && \
  adduser --system webapp -g webapp
COPY --from=build /build/server/build/erlang-shipment /app

# Run the server
WORKDIR /app
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["run"]
