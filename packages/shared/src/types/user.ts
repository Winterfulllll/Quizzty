export enum UserRole {
  PARTICIPANT = 'PARTICIPANT',
  ORGANIZER = 'ORGANIZER',
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: Date;
}
