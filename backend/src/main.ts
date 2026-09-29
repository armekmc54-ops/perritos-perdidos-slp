import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableCors();
  app.setGlobalPrefix("api/v1");

  // Aumentar el límite de tamaño de payload para permitir fotos en base64
  app.use(json({ limit: "25mb" }));
  app.use(urlencoded({ limit: "25mb", extended: true }));

  await app.listen(process.env.PORT ?? 3001);
  console.log(`🐾 Backend corriendo en http://localhost:${process.env.PORT ?? 3001}/api/v1`);
}
bootstrap();
