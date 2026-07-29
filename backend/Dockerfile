FROM maven:3.9.16-eclipse-temurin-21-alpine AS build

WORKDIR /workspace
COPY backend/pom.xml ./pom.xml
RUN mvn --batch-mode --no-transfer-progress dependency:go-offline
COPY backend/src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:21-jre-alpine

RUN apk --no-cache --update-cache upgrade p11-kit p11-kit-trust libexpat \
    && addgroup -S rill \
    && adduser -S -G rill -h /app rill
WORKDIR /app
COPY --from=build --chown=rill:rill /workspace/target/rill-backend-1.0.0.jar /app/rill.jar

USER rill
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/rill.jar"]
