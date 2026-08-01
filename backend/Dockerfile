FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -DskipTests
COPY src src
RUN ./mvnw package -DskipTests && cp target/backend-0.0.1-SNAPSHOT.jar app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S fujipp && adduser -S fujipp -G fujipp
COPY --from=builder /build/app.jar ./app.jar
USER fujipp
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
