FROM maven:3.9.16-eclipse-temurin-21-alpine AS build

WORKDIR /workspace
COPY backend/pom.xml ./pom.xml
RUN mvn --batch-mode --no-transfer-progress dependency:go-offline
COPY backend/src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:21-jre-alpine

RUN apk --no-cache --update-cache upgrade p11-kit p11-kit-trust libexpat \
    && addgroup -S typethock \
    && adduser -S -G typethock -h /app typethock
WORKDIR /app
COPY --from=build --chown=typethock:typethock /workspace/target/typethock-backend-1.0.0.jar /app/typethock.jar

USER typethock
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/typethock.jar"]
