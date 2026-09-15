export interface FixtureNote {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

export const seedFixtures: FixtureNote[] = [
  {
    "id": 1,
    "title": "Welcome to Porto Notes",
    "body": "A shared board for the <b>OWASP AppSec Days Porto</b> crew.<br>Add a note, search, share a link.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EPN%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-01T09:00:00.000Z"
  },
  {
    "id": 2,
    "title": "Douro sunset",
    "body": "Walk the <i>Ribeira</i> at 19:30 and cross the bridge to Gaia for the <b>Douro</b> sunset.",
    "avatar": "",
    "createdAt": "2026-09-01T10:15:00.000Z"
  },
  {
    "id": 3,
    "title": "Francesinha ranking",
    "body": "<b>Café Santiago</b> vs <b>Brasão</b>: still undecided.<br>Bring an appetite.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23b45309%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EJS%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-01T12:40:00.000Z"
  },
  {
    "id": 4,
    "title": "Livraria Lello tickets",
    "body": "Book online first: <a href=\"https://www.livrarialello.pt/\">livrarialello.pt</a>. The queue is long after 11:00.",
    "avatar": "",
    "createdAt": "2026-09-02T08:05:00.000Z"
  },
  {
    "id": 5,
    "title": "Tram 1 along the Douro",
    "body": "Take <i>tram 1</i> from Infante to Foz along the <b>Douro</b>.<br>Sit on the river side.",
    "avatar": "",
    "createdAt": "2026-09-02T14:30:00.000Z"
  },
  {
    "id": 6,
    "title": "Keynote room",
    "body": "The keynote is in the <b>main auditorium</b> at 09:30.<br>Coffee is outside the room.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%231d4ed8%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3ELW%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-03T07:45:00.000Z"
  }
];
