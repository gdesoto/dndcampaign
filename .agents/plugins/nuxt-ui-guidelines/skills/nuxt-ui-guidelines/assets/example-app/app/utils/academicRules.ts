export interface Section {
  id: string;
  courseId: string;
  name: string;
  instructor: string;
  room: string;
  schedule: string;
  capacity: number;
  studentIds: string[];
  published: boolean;
}
export interface EnrollmentRequest {
  id: string;
  sectionId: string;
  studentId: string;
  prerequisiteMet: boolean;
  requestedOn: string;
}
export function requestBlocker(request: EnrollmentRequest, section: Section | undefined, course: { status: string; studentIds: string[] } | undefined): string | undefined {
  if (!section || !course) return 'Course unavailable';
  if (course.status === 'Archived') return 'Course archived';
  if (course.studentIds.includes(request.studentId)) return 'Already enrolled';
  if (!request.prerequisiteMet) return 'Prerequisite required';
  const occupied = section.studentIds.filter(id => course.studentIds.includes(id)).length;
  if (occupied >= section.capacity) return 'Section full';
  return undefined;
}
export function publicationBlocker(section: Section, enrollment: number): string | undefined {
  if (!section.instructor.trim()) return 'Instructor required';
  if (!section.room.trim()) return 'Room required';
  if (enrollment > section.capacity) return 'Over capacity';
  return undefined;
}
