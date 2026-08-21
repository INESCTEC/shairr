import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FileStreamingService } from 'src/services/file-streaming.service';
import { CellTerm } from '../models/shairr/datasources/cell.model';
import { DatasetGroupModel } from '../models/shairr/datasources/dataset_group.model';
import { GenotypeModel } from '../models/shairr/datasources/genotype.model';
import { SampleModel } from '../models/shairr/datasources/sample.model';
import { StudyModel } from '../models/shairr/datasources/study.model';
import { SubjectModel } from '../models/shairr/datasources/subject.model';
import { UberonTerm } from '../models/shairr/datasources/uberon.model';
import { TaskModel } from '../models/shairr/task.model';
import { ToolModel } from '../models/shairr/tool.model';
import { UserModel } from '../models/shairr/user.model';

@Injectable({
    providedIn: 'root',
})
export class DatasourcesApiService {
    private shairrApiUrl: string = environment.shairrApiUrl;

    constructor(
        private fileStreaming: FileStreamingService,
        private keycloak: KeycloakService,
    ) { }

    /**
     * Handle API responses
     * Throws exception when HTTP status code doesn't match `success_code` and throws custom exception
     *
     * @param res Response object from request Promise
     * @param expectedCode HTTP status code to test against. Defaults to HTTP code 200.
     *                     Useful in case success code isn't 200. I.E: POSTs return 201.
     * @returns provided Response
     */
    private handleResponse(
        res: Response,
        expectedCode = HttpStatusCode.Ok,
        expectJson = true,
    ): Promise<any> {
        // Don't need to parse anything on delete requests. Just dump the empty response.
        if (res.status === HttpStatusCode.NoContent) {
            return res.text();
        }

        return expectJson ? res.json() : res.text();
    }

    private handleUploadFileResponse(
        res: Response,
        expectedCodes: number | number[] = [200, 201, 202], // Accept array
        expectJson = true,
    ): Promise<any> {
        // Convert single code to array
        const expectedStatuses = Array.isArray(expectedCodes)
            ? expectedCodes
            : [expectedCodes];

        if (!expectedStatuses.includes(res.status)) {
            return res.json().then((error: any) => {
                if (res.status == HttpStatusCode.Unauthorized) {
                    throw new Error('Unauthorized: ' + (error.detail || ''));
                }
                throw new Error(`Error ${res.status}: ${error.detail || ''}`);
            });
        }

        if (res.status === HttpStatusCode.NoContent) {
            return res.text();
        }

        return expectJson ? res.json() : res.text();
    }

    /**
     * Build HTTP Authentication string for bearer token
     * Based on the JWT stored in local storage
     *
     * @returns String containing bearer + JWT contained in local storage
     * @throws UnauthorizedException
     */
    private buildAuth(): string {
        return 'bearer ' + this.keycloak.getKeycloakInstance().token;
    }

    /**
     * Default generic actions
     */
    private get(endpoint: string, id?: number): Promise<any> {
        const url = this.shairrApiUrl + '/' + endpoint + (id ? '/' + id : '');

        return fetch(url, {
            headers: {
                Authorization: this.buildAuth(),
            },
        }).then((res) => {
            return res;
        });
    }

    private put(endpoint: string, body: any): Promise<any> {
        return fetch(this.shairrApiUrl + '/' + endpoint, {
            headers: {
                Authorization: this.buildAuth(),
                'content-type': 'application/json',
            },
            method: 'put',
            body: JSON.stringify(body),
        }).then((res) => {
            return res;
        });
    }

    private post(endpoint: string, body: any): Promise<any> {
        return fetch(this.shairrApiUrl + '/' + endpoint, {
            headers: {
                Authorization: this.buildAuth(),
                'content-type': 'application/json',
            },
            method: 'post',
            body: JSON.stringify(body),
        }).then((res) => {
            return res;
        });
    }

    private postFile(endpoint: string, body: any): Promise<any> {
        return fetch(this.shairrApiUrl + '/' + endpoint, {
            headers: {
                Authorization: this.buildAuth(),
                // Don't set content-type for FormData
            },
            method: 'post',
            body: body,
        }).then((res) => this.handleUploadFileResponse(res, [200, 201, 202])); // Change to 202
    }

    private delete(endpoint: string, id: number): Promise<any> {
        return fetch(this.shairrApiUrl + '/' + endpoint + '/' + id.toString(), {
            headers: {
                Authorization: this.buildAuth(),
            },
            method: 'delete',
        }).then((res) => this.handleResponse(res, HttpStatusCode.NoContent));
    }

    public deleteFile(id: number): Promise<any> {
        return this.delete('dataset', id);
    }

    /**
     * Clears user's entire session.
     */
    clearBrowserSession() {
        localStorage.clear();
    }

    async uploadFile(files: File[], annotated: boolean): Promise<any> {
        let formData: FormData = new FormData();

        for (let f of files) {
            formData.append('files', f);
        }
        formData.append('annotated', annotated.toString());

        // Use the postFile method but expect the new response format
        return this.postFile('dataset', formData).then((response: any) => {
            // Response should be: { session_id, message, total_files, websocket_url }
            return response;
        });
    }

    async uploadWithProgress(
        files: File[],
        annotated: boolean,
        fileType: string,
    ): Promise<void> {
        try {
            // Get session ID from upload
            const response = await this.uploadFile(files, annotated);
            const sessionId = response.session_id;

            // Connect to WebSocket for progress
            this.connectWebSocket(sessionId, fileType);
        } catch (error: any) {
            console.error(`Error uploading ${fileType} files:`, error);
            throw error;
        }
    }

    connectWebSocket(sessionId: string, fileType: string) {
        // Use the backend URL, not the frontend dev server
        const backendHost = this.shairrApiUrl
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
        const protocol = this.shairrApiUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${backendHost}/ws/upload-progress/${sessionId}`;

        console.log('Connecting to WebSocket:', wsUrl);

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`WebSocket connected for ${fileType} upload`);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'progress') {
                const progress = data.data;
                // Emit progress event or update service state
                this.emitUploadProgress(progress);
            } else if (data.type === 'completed') {
                this.emitUploadComplete(fileType);
                socket.close();
            } else if (data.type === 'failed') {
                this.emitUploadError(data.data?.error || 'Upload failed');
                socket.close();
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emitUploadError('Connection error');
        };
    }

    private emitUploadProgress(progress: any) {
        // Create custom event or use Subject/BehaviorSubject
        const event = new CustomEvent('upload-progress', {
            detail: progress,
        });
        window.dispatchEvent(event);
    }

    private emitUploadComplete(fileType: string) {
        const event = new CustomEvent('upload-complete', {
            detail: { fileType },
        });
        window.dispatchEvent(event);
    }

    private emitUploadError(error: string) {
        const event = new CustomEvent('upload-error', {
            detail: { error },
        });
        window.dispatchEvent(event);
    }

    private handleError(error: HttpErrorResponse) {
        if (error.status === 0) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error('An error occurred:', error.error);
        } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong.
            console.error(
                `Backend returned code ${error.status}, body was: `,
                error.error,
            );
        }
        // Return an observable with a user-facing error message.
        return throwError(
            () => new Error('Something bad happened; please try again later.'),
        );
    }

    async getStudies(): Promise<StudyModel[]> {
        return await this.get('study');
    }

    async getStudyById(studyId: number): Promise<StudyModel> {
        return await this.get('study', studyId);
    }

    async createStudy(study: StudyModel) {
        return await this.post('study', study);
    }

    async editStudy(study: StudyModel): Promise<boolean> {
        return await this.put(
            'study' + (study.id ? '/' + study.id : ''),
            study,
        );
    }

    async deleteStudy(studyId: number): Promise<boolean> {
        return await this.delete('study', studyId);
    }

    async getSubjects(): Promise<SubjectModel[]> {
        return await this.get('subject');
    }

    async getSubjectById(subjectId: number): Promise<SubjectModel> {
        return await this.get('subject', subjectId);
    }

    async createSubject(subject: SubjectModel) {
        return await this.post('subject', subject);
    }

    async editSubject(subject: SubjectModel): Promise<boolean> {
        return await this.put(
            'subject' + (subject.id ? '/' + subject.id : ''),
            subject,
        );
    }

    async deleteSubject(subjectId: number): Promise<boolean> {
        return await this.delete('subject', subjectId);
    }

    async getGenotypesBySubject(): Promise<object> {
        return await this.get('genotype/subjects');
    }

    async getGenotypesBySubjectId(
        subject_id: number,
    ): Promise<GenotypeModel[]> {
        return await this.get('genotype/subject/' + subject_id);
    }

    async addGenotypeToSubject(genotype: GenotypeModel, subject_id: number) {
        if (subject_id < 0) {
            return;
        }

        genotype.id_subject = subject_id;
        genotype.mhc_class = genotype.mhc_class.includes('CLASS')
            ? genotype.mhc_class
            : 'CLASS_' + genotype.mhc_class;

        const response = await this.post('genotype', genotype);
        return response;
    }

    async deleteGenotype(genotype_id: number) {
        console.log(genotype_id);
        return await this.delete('genotype', genotype_id);
    }

    async getSamples(): Promise<SampleModel[]> {
        return await this.get('sample');
    }

    async getSampleById(sampleId: number): Promise<SampleModel> {
        return await this.get('sample', sampleId);
    }

    async createSample(sample: SampleModel) {
        return await this.post('sample', sample);
    }

    async editSample(sample: SampleModel): Promise<boolean> {
        try {
            const response = await this.put(
                'sample' + (sample.id ? '/' + sample.id : ''),
                sample,
            );
            // 204 No Content means success
            return true;
        } catch (error) {
            console.error('Error editing sample:', error);
            return false;
        }
    }

    async deleteSample(sampleId: number): Promise<boolean> {
        return await this.delete('sample', sampleId);
    }

    async getDatasets(): Promise<any> {
        return await this.get('dataset');
    }

    getSampleDatasets(): Promise<Response> {
        return this.get('sample/datasets');
    }

    async getRearrangements(): Promise<any> {
        return await this.get('rearrangement');
    }

    async getDatasetById(datasetId: number): Promise<any> {
        return await this.get('dataset', datasetId);
    }

    async getDatasetPlain(datasetId: number): Promise<any> {
        return await this.get('dataset/' + datasetId + '/plain?head=100');
    }

    async getReads(): Promise<any> {
        return await this.get('read');
    }

    async getAnnotated(): Promise<any> {
        return await this.get('annotation');
    }

    async editFile(dataset: [number, string], file: any): Promise<boolean> {
        console.log(dataset);
        return await this.put(dataset[1] + '/' + dataset[0], file);
    }

    uploadFiles(files: File[], annotated: boolean): Promise<any> {
        const formData = new FormData();
        files.forEach((file) => {
            formData.append('files', file);
        });
        formData.append('annotated', annotated.toString());

        return fetch('/api/dataset', {
            method: 'POST',
            body: formData,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Upload failed');
                }
                return response.json();
            })
            .then((data) => {
                // Expecting: { session_id, message, total_files, websocket_url }
                return data;
            });
    }

    async downloadFile(datasetId: number): Promise<void> {
        return await this.get(`dataset/${datasetId}/download`);
    }

    async createDiagnosis(diagnosis: any): Promise<any> {
        return await this.post('diagnosis', diagnosis);
    }

    async getDiagnosis(): Promise<any> {
        return await this.get('diagnosis');
    }

    async getDiagnosisById(diagnosisId: number): Promise<any> {
        return await this.get('diagnosis', diagnosisId);
    }

    async updateDiagnosis(
        diagnosisId: number,
        diagnosis: any,
    ): Promise<boolean> {
        return await this.put(
            'diagnosis' + (diagnosisId ? '/' + diagnosisId : ''),
            diagnosis,
        );
    }

    async deleteDiagnosis(diagnosisId: number): Promise<boolean> {
        return await this.delete('diagnosis', diagnosisId);
    }

    async downloadStudyCSV(studyId: number): Promise<void> {
        return this.get(`study/${studyId}/download`);
    }

    async downloadSubjectCSV(subjectId: number): Promise<void> {
        return this.get(`subject/${subjectId}/download`);
    }

    async downloadSampleCSV(sampleId: number): Promise<void> {
        return this.get(`sample/${sampleId}/download`);
    }

    async importStudyCSV(file: File): Promise<void> {
        let formData: FormData = new FormData();
        formData.append('csv_file', file);
        return this.postFile('studies/import', formData);
    }

    async importSubjectsCSV(
        file: File,
        study_id: Number | undefined,
    ): Promise<void> {
        let formData: FormData = new FormData();
        formData.append(
            'selected_study_id',
            study_id ? study_id.toString() : '',
        );
        formData.append('csv_file', file);
        return this.postFile('subjects/import', formData);
    }

    async importSamplesCSV(
        file: File,
        study_id: Number | undefined,
        subject_id: Number | undefined,
    ): Promise<void> {
        let formData: FormData = new FormData();
        formData.append('csv_file', file);
        formData.append(
            'selected_study_id',
            study_id ? study_id.toString() : '',
        );
        formData.append(
            'selected_subject_id',
            subject_id ? subject_id.toString() : '',
        );
        return this.postFile('samples/import', formData);
    }

    async downloadStudiesCSV(): Promise<void> {
        return this.get(`studies/download`);
    }

    async downloadSubjectsCSV(): Promise<void> {
        return this.get(`subjects/download`);
    }

    async downloadSubjectsCSVFromStudy(
        study_id: Number | undefined,
    ): Promise<void> {
        if (study_id) {
            return this.get(`study/${study_id}/subjects/download`);
        }
    }

    async downloadSamplesCSVFromStudy(
        study_id: Number | undefined,
    ): Promise<void> {
        if (study_id) {
            return this.get(`study/${study_id}/samples/download`);
        }
    }

    async downloadSamplesCSVFromSubject(
        subject_id: Number | undefined,
    ): Promise<void> {
        if (subject_id) {
            return this.get(`subject/${subject_id}/samples/download`);
        }
    }

    async downloadSamplesCSV(): Promise<void> {
        return this.get(`samples/download`);
    }

    async getDatasetGroups(): Promise<DatasetGroupModel[]> {
        return this.get(`dataset/groups`);
    }

    async getTimepointsBySubject(subjectIds: number[]): Promise<any> {
        // Convert each ID to number to ensure proper type
        const validIds = subjectIds.map((id) => Number(id));

        if (validIds.length === 0) {
            return Promise.resolve([]); // Return empty array if no valid IDs
        }

        const queryParams = new URLSearchParams();
        queryParams.append('ids', validIds.join(','));
        const url = `timepoints/subjects?${queryParams.toString()}`;

        return await this.get(url);
    }

    async getTimepoints(): Promise<any> {
        return await this.get('timepoint');
    }

    async getTimepointById(timepointId: number): Promise<any> {
        return await this.get('timepoint', timepointId);
    }

    async createTimepoint(timepoint: any) {
        return await this.post('timepoint', timepoint);
    }

    async getSubjectTimepoints(subjectId: number): Promise<any> {
        return await this.get(`timepoint/subject/${subjectId}`);
    }

    async updateTimepoint(
        timepointId: number,
        timepoint: any,
    ): Promise<boolean> {
        return await this.put(
            'timepoint' + (timepointId ? '/' + timepointId : ''),
            timepoint,
        );
    }

    async deleteTimepoint(timepointId: number): Promise<boolean> {
        return await this.delete('timepoint', timepointId);
    }

    async getRepository(): Promise<any> {
        return await this.get('repository');
    }

    async updateRepository(body: any): Promise<any> {
        return await this.put('repository', body);
    }

    async getUser(): Promise<UserModel> {
        return await this.get('user').then((res) => this.handleResponse(res));
    }

    async updateUser(user_body: UserModel): Promise<any> {
        return await this.put('user', user_body);
    }

    async applyTimelineTemplate(source_id: number, target_id: number) {
        return await this.put(
            'subject/' + target_id + '/template/' + source_id,
            {},
        );
    }

    async applyTimelineTemplateStudy(source_id: number) {
        return await this.put('subject/' + source_id + '/template/study', {});
    }

    // Ontology Search Methods
    async searchUberon(query: string): Promise<UberonTerm[]> {
        try {
            const response = await this.get(
                `uberon/search?q=${encodeURIComponent(query)}&limit=10`,
            );
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('Error searching Uberon:', error);
            return [];
        }
    }

    async searchCell(query: string): Promise<CellTerm[]> {
        try {
            const response = await this.get(
                `cell/search?q=${encodeURIComponent(query)}&limit=10`,
            );
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('Error searching Cell ontology:', error);
            return [];
        }
    }

    async getUberonTermById(id: string): Promise<UberonTerm | null> {
        try {
            const response = await this.get(`uberon/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching Uberon term:', error);
            return null;
        }
    }

    async getCellTermById(id: string): Promise<CellTerm | null> {
        try {
            const response = await this.get(`cell/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching Cell term:', error);
            return null;
        }
    }

    async addGenotypesBulk(
        alleleName: string,
        alleleClass: string,
        subjectIds: number[],
    ): Promise<any> {
        const formattedClass = alleleClass.includes('CLASS')
            ? alleleClass
            : 'CLASS_' + alleleClass;

        const body = {
            allele_name: alleleName,
            allele_class: formattedClass,
            subject_ids: subjectIds,
        };

        return this.post('genotype/bulk', body);
    }

    async deleteGenotypesBulk(
        alleleName: string,
        subjectIds: number[],
    ): Promise<any> {
        const body = {
            allele_name: alleleName,
            subject_ids: subjectIds,
        };

        return this.deleteWithBody('genotype/bulk', body);
    }

    private deleteWithBody(endpoint: string, body: any): Promise<any> {
        return fetch(this.shairrApiUrl + '/' + endpoint, {
            headers: {
                Authorization: this.buildAuth(),
                'Content-Type': 'application/json',
            },
            method: 'delete',
            body: JSON.stringify(body),
        }).then((res) => this.handleResponse(res, HttpStatusCode.NoContent));
    }

    getTask(id_task: number): Promise<TaskModel> {
        return this.get('task', id_task);
    }

    getDatasetRaw(
        id_dataset: number,
        head: number | null = null,
    ): Promise<string> {
        let url = new URL(this.shairrApiUrl + '/dataset/' + id_dataset + '/raw');

        if (head) {
            url.searchParams.append('head', head.toString());
        }

        return fetch(url, {
            headers: {
                Authorization: this.buildAuth(),
            },
        }).then((res) => this.handleResponse(res, HttpStatusCode.Ok, false))
    }

    togglePublicStudyStatus(study_id: number) {
        return this.put('study/' + study_id + '/public-status', {});
    }

    toggleStatsSelection(study_id: number) {
        return this.put('study/' + study_id + '/stats-selection', {});
    }

    async getTools(page?: number, limit?: number, search?: string): Promise<ToolModel[]> {
        let url = new URL(this.shairrApiUrl + '/tool');

        if (page) {
            url.searchParams.append('page', page.toString());
        }
        if (limit) {
            url.searchParams.append('limit', limit.toString());
        }

        if (search) {
            url.searchParams.append('search', search.toString());
        }

        return fetch(url, {
            headers: {
                Authorization: this.buildAuth(),
            },
        }).then((res) => this.handleResponse(res));
    }

    async installImmunarch(force: boolean = false): Promise<any> {
        const body = { force: force };

        const toolImmunearch = await this.getTools(undefined, undefined, "R-Immunarch");

        if (!toolImmunearch || !toolImmunearch.length) {
            throw Error("Immunearch not present in API");
        }

        const response = await this.post(`tool/${toolImmunearch[0].id}/install`, body);

        // If the response has a message about already installed, treat as success
        if (
            response &&
            response.message &&
            response.message.includes('already installed')
        ) {
            return {
                id: null,
                alreadyInstalled: true,
                message: response.message,
            };
        }

        return response;
    }

    async isImmunarchInstalled(): Promise<boolean> {
        try {
            const response = await this.get('tool/immunarch/check');
            const data = await response.json();
            return data.installed === true;
        } catch {
            return false;
        }
    }

    getTaskStatus(taskId: number): Promise<any> {
        return this.get('task', taskId);
    }

    createImmunarchStatsTask(
        repertoireIds: number[],
        selectedStats: string[], // e.g. ['gene_usage','repertoire_overlap','number_clonotypes', 'distro_clonotypes', 'distro_cdr3_length', 'basic_clonal_proportion']
        ignoreCache: boolean,
        id_pipeline_step?: number,
    ) {
        console.log('Immunarch called.');
        const parameters: Record<string, string> = {
            repertoires_length: String(repertoireIds.length),
        };
        for (const k of selectedStats) parameters[k] = 'true';
        parameters['ignore_cache'] = ignoreCache ? 'true' : 'false';

        const body = {
            id_pipeline_step,
            parameters,
            datasets: { repertoire: repertoireIds }, // array on purpose
        };

        return fetch(
            this.shairrApiUrl + '/task/stats/r-immunarch-compute-stats',
            {
                headers: {
                    Authorization: this.buildAuth(),
                    'content-type': 'application/json',
                },
                method: 'post',
                body: JSON.stringify(body),
            },
        ).then((res) => this.handleResponse(res)); // expects 200 OK
    }

    async getRepertoires(): Promise<any> {
        return this.get('airr/v1/repertoire');
    }
}
