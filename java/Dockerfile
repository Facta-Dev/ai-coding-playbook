FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

# Pinned runtime: never `latest` (mutable tag, unreviewed upgrade).
FROM quay.io/wildfly/wildfly:41.0.1.Final-jdk21
COPY --from=build /src/target/app.war /opt/jboss/wildfly/standalone/deployments/app.war
USER jboss
EXPOSE 8080
# The deployment marker is written by WildFly when the WAR is deployed; it
# needs no curl/wget in the minimal runtime image.
HEALTHCHECK --interval=30s --timeout=3s --retries=5 \
  CMD test -f /opt/jboss/wildfly/standalone/deployments/app.war.deployed || exit 1
