# Resonance Framework - Multi-stage Docker Build
# Build with: docker build -t registry.local/operations-console:latest -f Dockerfile .

# ===== Stage 1: Build with Maven =====
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build

# Copy pom.xml files first for better caching
COPY pom.xml .
COPY modules modules
COPY apps apps
COPY projects projects

# Download dependencies (cached unless pom.xml changes)
RUN mvn dependency:go-offline -B || true

# Copy source code and build
COPY . .
RUN mvn clean package -DskipTests -B && \
    echo "Build completed successfully!"

# ===== Stage 2: Runtime =====
FROM eclipse-temurin:17-jre-alpine

# Install minimal dependencies
RUN apk add --no-cache bash curl

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the built JAR
COPY --from=builder /build/apps/operations-console/target/operations-console.jar /app/operations-console.jar

# Copy necessary resources
COPY ops/ /app/ops/
COPY data/ /app/data/
COPY docs/ /app/docs/
COPY templates/ /app/templates/

# Set environment variables
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC"
ENV SERVER_PORT=18000
ENV SPRING_PROFILES_ACTIVE=prod

# Use non-root user
USER appuser

# Expose port
EXPOSE 18000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:18000/actuator/health || exit 1

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/operations-console.jar"]
