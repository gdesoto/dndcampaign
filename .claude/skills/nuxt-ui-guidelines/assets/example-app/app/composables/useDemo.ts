export interface Student {
  id: string;
  name: string;
  email: string;
  year: number;
}
export interface Course {
  id: string;
  name: string;
  description: string;
  credits: number;
  department: string;
  instructor: string;
  startsOn: string;
  studentIds: string[];
  status: "Active" | "Archived";
}
export interface GameSession {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  participantIds: string[];
  status: "Planned" | "Archived";
}
export function useDemo() {
  const students = useState<Student[]>("students", () =>
    [
      "Alex Morgan",
      "Jordan Lee",
      "Sam Rivera",
      "Taylor Chen",
      "Casey Brooks",
      "Riley Patel",
      "Avery James",
      "Cameron Davis",
      "Quinn Ellis",
      "Parker Reed",
      "Drew Wilson",
      "Skyler Kim",
    ].map((name, i) => ({
      id: "s" + i,
      name,
      email: name.toLowerCase().replace(" ", ".") + "@example.test",
      year: i % 4 + 1,
    })),
  );
  const subjects = [
    "Biology",
    "Creative Writing",
    "World History",
    "Applied Mathematics",
    "Visual Arts",
    "Computer Science",
    "Environmental Studies",
    "Music Theory",
  ];
  const courses = useState<Course[]>("courses", () =>
    Array.from({ length: 36 }, (_, i) => ({
      id: "c" + (i + 1),
      name:
        subjects[i % subjects.length] +
        " " +
        (100 + Math.floor(i / subjects.length) * 100 + 1),
      description: [
        "Explore foundational ideas through practical projects and collaborative study.",
        "Connect theory to everyday questions through discussion and independent research.",
        "Develop a confident practice through workshops, feedback, and hands-on exploration.",
      ][i % 3]!,
      credits: [3, 4, 2][i % 3]!,
      department: ['Science', 'Humanities', 'Humanities', 'Mathematics', 'Arts', 'Technology', 'Science', 'Arts'][i % 8]!,
      instructor: ['Dr. Priya Raman', 'Morgan Bell', 'Dr. Elena Cruz', 'Alex Novak'][i % 4]!,
      startsOn: '2026-09-21',
      studentIds: students.value.slice(0, (i % 10) + 2).map((s) => s.id),
      status: i === 9 ? "Archived" : "Active",
    })),
  );
  const sessions = useState<GameSession[]>("sessions", () => [
    {
      id: "g1",
      title: "The sunken observatory",
      description:
        "Follow the star chart beneath the harbor. Bring a level 4 character.",
      scheduledAt: "2026-09-12T18:30",
      participantIds: ["s0", "s2", "s5", "s7"],
      status: "Planned",
    },
    {
      id: "g2",
      title: "A quiet evening in Catan",
      description: "A friendly table, fresh maps, and room for one more.",
      scheduledAt: "2026-09-15T19:00",
      participantIds: ["s1", "s3", "s4"],
      status: "Planned",
    },
    {
      id: "g3",
      title: "Beyond the northern gate",
      description: "Continue the campaign at the edge of the winter forest.",
      scheduledAt: "2026-09-19T17:00",
      participantIds: ["s0", "s1", "s6"],
      status: "Archived",
    },
  ]);
  return { students, courses, sessions };
}
