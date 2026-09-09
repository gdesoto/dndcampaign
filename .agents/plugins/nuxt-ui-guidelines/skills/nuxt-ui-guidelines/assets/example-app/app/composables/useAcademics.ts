import { requestBlocker, publicationBlocker } from '../utils/academicRules';
import type { Section, EnrollmentRequest } from '../utils/academicRules';
export interface Assessment { id: string; courseId: string; name: string; dueOn: string; weight: number }

export function useAcademics() {
  const { courses, students } = useDemo();
  const toast = useToast();
  const sections = useState<Section[]>('academic-sections', () => [
    { id: 'sec1', courseId: 'c1', name: 'Section A', instructor: 'Dr. Priya Raman', room: 'Whitlock 214', schedule: 'Mon, Wed · 09:00', capacity: 3, studentIds: ['s0', 's1'], published: true },
    { id: 'sec2', courseId: 'c2', name: 'Section A', instructor: 'Morgan Bell', room: 'Arts 108', schedule: 'Tue, Thu · 13:00', capacity: 2, studentIds: ['s0', 's1', 's2'], published: false },
    { id: 'sec3', courseId: 'c3', name: 'Section A', instructor: '', room: 'Whitlock 216', schedule: 'Mon, Wed · 11:00', capacity: 6, studentIds: ['s0', 's1', 's2', 's3'], published: false },
    { id: 'sec4', courseId: 'c1', name: 'Section B', instructor: '', room: 'Science 102', schedule: 'Fri · 14:00', capacity: 8, studentIds: [], published: false }
  ]);
  const requests = useState<EnrollmentRequest[]>('academic-requests', () => [
    { id: 'req1', sectionId: 'sec1', studentId: 's4', prerequisiteMet: true, requestedOn: '2026-09-07' },
    { id: 'req2', sectionId: 'sec1', studentId: 's5', prerequisiteMet: true, requestedOn: '2026-09-08' },
    { id: 'req3', sectionId: 'sec2', studentId: 's6', prerequisiteMet: true, requestedOn: '2026-09-08' },
    { id: 'req4', sectionId: 'sec3', studentId: 's7', prerequisiteMet: false, requestedOn: '2026-09-06' }
  ]);
  const assessments = useState<Assessment[]>('academic-assessments', () => courses.value.flatMap(course => [
    { id: `${course.id}-a1`, courseId: course.id, name: 'Foundations assignment', dueOn: '2026-10-05', weight: 20 },
    { id: `${course.id}-a2`, courseId: course.id, name: 'Applied project', dueOn: '2026-11-09', weight: 30 },
    { id: `${course.id}-a3`, courseId: course.id, name: 'Final portfolio', dueOn: '2026-12-14', weight: 50 }
  ]));
  const liveSections = computed(() => sections.value.filter(s => courses.value.some(c => c.id === s.courseId)));
  function courseFor(section: Section) { return courses.value.find(c => c.id === section.courseId); }
  function enrollment(section: Section) { return section.studentIds.filter(id => courseFor(section)?.studentIds.includes(id)).length; }
  function sectionIssue(section: Section) { return publicationBlocker(section, enrollment(section)); }
  const requestRows = computed(() => requests.value.map(request => {
    const section = sections.value.find(s => s.id === request.sectionId);
    const course = section && courseFor(section);
    return { ...request, section, course, student: students.value.find(s => s.id === request.studentId), blocker: requestBlocker(request, section, course) };
  }).filter(r => r.course && r.student));
  function approve(id: string) {
    const request = requests.value.find(r => r.id === id);
    if (!request) throw new Error('This request is no longer available.');
    const section = sections.value.find(s => s.id === request.sectionId);
    const course = section && courseFor(section);
    const blocker = requestBlocker(request, section, course);
    if (blocker) throw new Error(blocker);
    course!.studentIds.push(request.studentId);
    section!.studentIds.push(request.studentId);
    requests.value = requests.value.filter(r => r.id !== id);
    toast.add({ title: `Enrolled ${students.value.find(s => s.id === request.studentId)?.name}`, color: 'success' });
  }
  function decline(id: string) {
    const request = requests.value.find(r => r.id === id);
    requests.value = requests.value.filter(r => r.id !== id);
    toast.add({ title: `Declined request for ${students.value.find(s => s.id === request?.studentId)?.name || 'student'}`, color: 'success' });
  }
  function publish(section: Section) {
    if (courseFor(section)?.status !== 'Active') throw new Error('Course must be active.');
    const issue = sectionIssue(section);
    if (issue) throw new Error(issue);
    section.published = true;
    toast.add({ title: `Published ${courseFor(section)?.name} · ${section.name}`, color: 'success' });
  }
  return { sections, liveSections, requests, requestRows, assessments, courseFor, enrollment, sectionIssue, approve, decline, publish };
}
