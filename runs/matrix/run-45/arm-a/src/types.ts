export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

export interface UrlState {
  query: string;
  noteId: number | null;
}
