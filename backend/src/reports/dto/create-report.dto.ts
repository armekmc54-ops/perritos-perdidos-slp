import { ReportType, Status, Species } from '@prisma/client';

export class CreateReportDto {
  title?: string;
  petName?: string;
  description: string;
  type: ReportType;
  species?: Species;
  breed?: string;
  primaryColor?: string;
  size?: string;
  aiTags?: string[];
  latitude: number;
  longitude: number;
  mediaUrl?: string;
  images?: string[];
  contactPhone?: string;
  reward?: number;
  userEmail?: string;
  status?: Status;
}

export class ResolveReportDto {
  requesterEmail: string;
  finderUserId?: string;
  validatedSightingIds?: string[];
}
