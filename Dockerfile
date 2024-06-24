FROM ghcr.io/gleam-lang/gleam:v1.2.1-erlang-alpine

# Add project code
COPY ./client /build/client
COPY ./shared /build/shared
COPY ./server /build/server

RUN cd /build/client \
  && gleam run -m lustre/dev build app

RUN cp /build/client/priv/static/* /build/server/priv/static/

# Compile the project
RUN cd /build/server \
  && gleam export erlang-shipment \
  && mv build/erlang-shipment /app \
  && rm -r /build

# Run the server
WORKDIR /app
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["run"]

