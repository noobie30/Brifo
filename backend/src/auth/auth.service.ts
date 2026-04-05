import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { UsersService } from "../users/users.service";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { GoogleAuthDto } from "./dto/google-auth.dto";

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

@Injectable()
export class AuthService {
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.oauthClient = new OAuth2Client(
      this.configService.get<string>("GOOGLE_CLIENT_ID"),
    );
  }

  async signInWithGoogle(payload: GoogleAuthDto): Promise<AuthResponse> {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    if (!clientId) {
      throw new InternalServerErrorException(
        "GOOGLE_CLIENT_ID is not configured on the server",
      );
    }

    const tokenPayload = await this.verifyGoogleToken(
      payload.idToken,
      clientId,
    );
    if (!tokenPayload?.sub || !tokenPayload?.email || !tokenPayload?.name) {
      throw new BadRequestException("Invalid Google token payload");
    }

    if (!tokenPayload.email_verified) {
      throw new BadRequestException("Google account email must be verified");
    }

    const user = await this.usersService.upsertGoogleUser({
      googleId: tokenPayload.sub,
      email: tokenPayload.email,
      name: tokenPayload.name,
      avatarUrl: tokenPayload.picture,
    });

    const jwtPayload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private async verifyGoogleToken(
    idToken: string,
    clientId: string,
  ): Promise<{
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  }> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      return ticket.getPayload() ?? {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Wrong recipient")) {
        throw new BadRequestException(
          "Google token audience mismatch. Ensure desktop and API use the same GOOGLE_CLIENT_ID and restart both apps.",
        );
      }
      if (message.toLowerCase().includes("expired")) {
        throw new BadRequestException(
          "Google token expired. Please sign in again.",
        );
      }
      throw new BadRequestException(`Invalid Google token: ${message}`);
    }
  }
}
