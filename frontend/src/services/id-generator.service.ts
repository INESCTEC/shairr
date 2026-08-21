import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class IdGeneratorService {
    
    generateStudyId(study: any, existingIds: string[]): string {
        let diseasePart = '';
        let locationPart = '';
        let year = '';
        
        if (study.study_title) {
            const title: string = study.study_title;
            
            const yearMatch: RegExpMatchArray | null = title.match(/20\d{2}/);
            if (yearMatch) {
                year = yearMatch[0].substring(2);
            }
            
            const diseaseKeywords: { [key: string]: string } = {
                'covid': 'C19',
                'coronavirus': 'C19',
                'influenza': 'FLU',
                'flu': 'FLU',
                'mmr': 'MMR',
                'hpv': 'HPV',
                'meningococcal': 'MNG',
                'tdap': 'TDAP',
                'rsv': 'RSV',
                'zoster': 'RZV',
                'hepatitis': 'HEP',
                'yellow fever': 'YFV'
            };
            
            const locationKeywords: string[] = [
                'frankfurt', 'venezuela', 'uk', 'usa', 'europe', 'asia', 
                'africa', 'germany', 'spain', 'italy', 'france', 'china',
                'japan', 'brazil', 'canada', 'mexico', 'india'
            ];
            
            const lowerTitle: string = title.toLowerCase();
            
            for (const [key, value] of Object.entries(diseaseKeywords)) {
                if (lowerTitle.includes(key)) {
                    diseasePart = value;
                    break;
                }
            }
            
            for (const loc of locationKeywords) {
                if (lowerTitle.includes(loc)) {
                    locationPart = loc.substring(0, 3).toUpperCase();
                    break;
                }
            }
        }
        
        if (study.study_description) {
            const desc: string = study.study_description.toLowerCase();
            if (!diseasePart) {
                for (const [key, value] of Object.entries({
                    'covid': 'C19', 'coronavirus': 'C19', 'influenza': 'FLU', 'flu': 'FLU',
                    'mmr': 'MMR', 'hpv': 'HPV', 'meningococcal': 'MNG', 'tdap': 'TDAP',
                    'rsv': 'RSV', 'zoster': 'RZV', 'hepatitis': 'HEP', 'yellow fever': 'YFV'
                })) {
                    if (desc.includes(key)) {
                        diseasePart = value;
                        break;
                    }
                }
            }
        }
        
        let base: string = 'STDY';
        if (diseasePart && locationPart) {
            base = diseasePart + locationPart;
        } else if (diseasePart) {
            base = diseasePart;
        } else if (locationPart) {
            base = locationPart;
        } else if (study.study_title) {
            const words: string[] = study.study_title.split(/[\s-]+/);
            const firstWords: string[] = words.slice(0, 2);
            base = firstWords.map((w: string) => w.substring(0, 2).toUpperCase()).join('');
        }
        
        let counter: number = 1;
        let newId: string = year ? `${base}${year}${counter.toString().padStart(2, '0')}` : `${base}${counter.toString().padStart(2, '0')}`;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (existingIds.includes(newId) && attempts < maxAttempts) {
            counter++;
            newId = year ? `${base}${year}${counter.toString().padStart(2, '0')}` : `${base}${counter.toString().padStart(2, '0')}`;
            attempts++;
        }
        
        if (existingIds.includes(newId)) {
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            newId = `${base}_${randomSuffix}`;
            let finalAttempts = 0;
            while (existingIds.includes(newId) && finalAttempts < 10) {
                newId = `${base}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                finalAttempts++;
            }
        }
        
        return newId;
    }
    
    generateSubjectId(subject: any, studyId: string, study: any, existingIds: string[]): string {
        let diseasePart = '';
        let speciesPart = '';
        let year = '';
        let base = 'SUBJ';
        let studyPrefix = '';
        
        if (study && study.study_title) {
            const studyTitle: string = study.study_title;
            
            const yearMatch: RegExpMatchArray | null = studyTitle.match(/20\d{2}/);
            if (yearMatch) {
                year = yearMatch[0].substring(2);
            }
            
            const studyWords: string[] = studyTitle.split(/[\s-]+/);
            studyPrefix = studyWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 3);
            
            const diseaseKeywords: { [key: string]: string } = {
                'covid': 'C19', 'coronavirus': 'C19', 'influenza': 'FLU', 'flu': 'FLU',
                'mmr': 'MMR', 'hpv': 'HPV', 'meningococcal': 'MNG', 'tdap': 'TDAP',
                'rsv': 'RSV', 'zoster': 'RZV', 'hepatitis': 'HEP', 'yellow fever': 'YFV'
            };
            
            const lowerTitle: string = studyTitle.toLowerCase();
            for (const [key, value] of Object.entries(diseaseKeywords)) {
                if (lowerTitle.includes(key)) {
                    diseasePart = value;
                    break;
                }
            }
        }
        
        if (study && study.study_description && !diseasePart) {
            const desc: string = study.study_description.toLowerCase();
            const diseaseKeywords: { [key: string]: string } = {
                'covid': 'C19', 'coronavirus': 'C19', 'influenza': 'FLU', 'flu': 'FLU',
                'mmr': 'MMR', 'hpv': 'HPV', 'meningococcal': 'MNG', 'tdap': 'TDAP',
                'rsv': 'RSV', 'zoster': 'RZV', 'hepatitis': 'HEP', 'yellow fever': 'YFV'
            };
            for (const [key, value] of Object.entries(diseaseKeywords)) {
                if (desc.includes(key)) {
                    diseasePart = value;
                    break;
                }
            }
        }
        
        if (subject.species?.label) {
            const speciesLabel: string = subject.species.label;
            if (speciesLabel.includes('Human')) speciesPart = 'HUM';
            else if (speciesLabel.includes('Mouse')) speciesPart = 'MUS';
            else if (speciesLabel.includes('Rat')) speciesPart = 'RAT';
            else {
                const speciesWords: string[] = speciesLabel.split(/\s+/);
                speciesPart = speciesWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 3);
            }
        }
        
        if (subject.diagnosis && subject.diagnosis.length > 0) {
            const diagnosis: any = subject.diagnosis[0];
            if (diagnosis.disease_diagnosis?.label) {
                const diseaseWords: string[] = diagnosis.disease_diagnosis.label.split(/\s+/);
                const diseaseCode: string = diseaseWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 2);
                diseasePart = diseaseCode;
            }
        }
        
        if (diseasePart && speciesPart) {
            base = diseasePart + speciesPart;
        } else if (diseasePart) {
            base = diseasePart;
        } else if (speciesPart) {
            base = speciesPart;
        }
        
        let counter: number = 1;
        let newId: string = studyPrefix ? 
            (year ? `${studyPrefix}${year}_${base}${counter}` : `${studyPrefix}_${base}${counter}`) : 
            (year ? `${studyId}${year}_${base}${counter}` : `${studyId}_${base}${counter}`);
        let attempts = 0;
        const maxAttempts = 100;
        
        while (existingIds.includes(newId) && attempts < maxAttempts) {
            counter++;
            newId = studyPrefix ? 
                (year ? `${studyPrefix}${year}_${base}${counter}` : `${studyPrefix}_${base}${counter}`) : 
                (year ? `${studyId}${year}_${base}${counter}` : `${studyId}_${base}${counter}`);
            attempts++;
        }
        
        if (existingIds.includes(newId)) {
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            newId = `${studyPrefix || studyId}_${base}_${randomSuffix}`;
            let finalAttempts = 0;
            while (existingIds.includes(newId) && finalAttempts < 10) {
                newId = `${studyPrefix || studyId}_${base}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                finalAttempts++;
            }
        }
        
        return newId;
    }
    
    generateSampleId(sample: any, subjectId: string, subject: any, study: any, existingIds: string[]): string {
        let diseasePart = '';
        let tissuePart = '';
        let cellPart = '';
        let seqPart = '';
        let year = '';
        let base = 'SAMP';
        let prefix = '';
        
        if (study && study.study_title) {
            const studyTitle: string = study.study_title;
            
            const yearMatch: RegExpMatchArray | null = studyTitle.match(/20\d{2}/);
            if (yearMatch) {
                year = yearMatch[0].substring(2);
            }
            
            const studyWords: string[] = studyTitle.split(/[\s-]+/);
            prefix = studyWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 2);
            
            const diseaseKeywords: { [key: string]: string } = {
                'covid': 'C19', 'coronavirus': 'C19', 'influenza': 'FLU', 'flu': 'FLU',
                'mmr': 'MMR', 'hpv': 'HPV', 'meningococcal': 'MNG', 'tdap': 'TDAP',
                'rsv': 'RSV', 'zoster': 'RZV', 'hepatitis': 'HEP', 'yellow fever': 'YFV'
            };
            
            const lowerTitle: string = studyTitle.toLowerCase();
            for (const [key, value] of Object.entries(diseaseKeywords)) {
                if (lowerTitle.includes(key)) {
                    diseasePart = value;
                    break;
                }
            }
        }
        
        if (study && study.study_description && !diseasePart) {
            const desc: string = study.study_description.toLowerCase();
            const diseaseKeywords: { [key: string]: string } = {
                'covid': 'C19', 'coronavirus': 'C19', 'influenza': 'FLU', 'flu': 'FLU',
                'mmr': 'MMR', 'hpv': 'HPV', 'meningococcal': 'MNG', 'tdap': 'TDAP',
                'rsv': 'RSV', 'zoster': 'RZV', 'hepatitis': 'HEP', 'yellow fever': 'YFV'
            };
            for (const [key, value] of Object.entries(diseaseKeywords)) {
                if (desc.includes(key)) {
                    diseasePart = value;
                    break;
                }
            }
        }
        
        if (subject && subject.subject_id) {
            const subjectIdStr: string = subject.subject_id;
            const subjectMatch: RegExpMatchArray | null = subjectIdStr.match(/[A-Z]+/g);
            if (subjectMatch) {
                prefix = (prefix || '') + subjectMatch.join('').substring(0, 2);
            }
        }
        
        if (sample.tissue?.label) {
            const tissueLabel: string = sample.tissue.label;
            if (tissueLabel.includes('Blood')) tissuePart = 'BLD';
            else if (tissueLabel.includes('PBMC')) tissuePart = 'PBMC';
            else if (tissueLabel.includes('Tissue')) tissuePart = 'TIS';
            else {
                const tissueWords: string[] = tissueLabel.split(/\s+/);
                tissuePart = tissueWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 3);
            }
        }
        
        if (sample.cell_subset?.label) {
            const cellLabel: string = sample.cell_subset.label;
            const cellWords: string[] = cellLabel.split(/\s+/);
            cellPart = cellWords.map((w: string) => w[0].toUpperCase()).join('').substring(0, 2);
        }
        
        if (sample.sequencing_type) {
            const seqType: string = sample.sequencing_type;
            if (seqType.includes('BULK')) seqPart = 'BLK';
            else if (seqType.includes('SINGLE')) seqPart = 'SC';
        }
        
        const parts: string[] = [];
        if (diseasePart) parts.push(diseasePart);
        if (tissuePart) parts.push(tissuePart);
        if (cellPart) parts.push(cellPart);
        if (seqPart) parts.push(seqPart);
        
        if (parts.length > 0) {
            base = parts.join('');
        }
        
        let counter: number = 1;
        let newId: string = prefix ? 
            (year ? `${prefix}${year}_${base}${counter}` : `${prefix}_${base}${counter}`) : 
            (year ? `${subjectId}${year}_${base}${counter}` : `${subjectId}_${base}${counter}`);
        let attempts = 0;
        const maxAttempts = 100;
        
        while (existingIds.includes(newId) && attempts < maxAttempts) {
            counter++;
            newId = prefix ? 
                (year ? `${prefix}${year}_${base}${counter}` : `${prefix}_${base}${counter}`) : 
                (year ? `${subjectId}${year}_${base}${counter}` : `${subjectId}_${base}${counter}`);
            attempts++;
        }
        
        if (existingIds.includes(newId)) {
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            newId = `${prefix || subjectId}_${base}_${randomSuffix}`;
            let finalAttempts = 0;
            while (existingIds.includes(newId) && finalAttempts < 10) {
                newId = `${prefix || subjectId}_${base}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                finalAttempts++;
            }
        }
        
        return newId;
    }
}