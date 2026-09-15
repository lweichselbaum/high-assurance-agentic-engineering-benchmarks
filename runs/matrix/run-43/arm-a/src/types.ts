export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

export interface RouteState {
  q: string;
  noteId: number | null;
}
