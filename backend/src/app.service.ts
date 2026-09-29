import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: "ok",
      project: "Perritos Perdidos SLP",
      timestamp: new Date().toISOString(),
    };
  }
}
