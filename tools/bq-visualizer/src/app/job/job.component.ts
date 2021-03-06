import {Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {PageEvent} from '@angular/material';
import {MatPaginator} from '@angular/material/paginator';
import {Router} from '@angular/router';
import {Observable, of} from 'rxjs';
import {Subject, Subscription} from 'rxjs';
import {catchError, publishReplay, refCount, take, takeUntil} from 'rxjs/operators';

import {BigQueryService} from '../big-query.service';
import {BqJob} from '../bq_job';
import {BqQueryPlan} from '../bq_query_plan';
import {LogService} from '../log.service';
import {ProjectsComponent} from '../projects/projects.component';
import {QueryPlanService} from '../query-plan.service';
import {BqListJobResponse, BqProject, BqProjectListResponse, Job, Project} from '../rest_interfaces';

@Component({
  selector: 'app-job',
  templateUrl: './job.component.html',
  styleUrls: ['./job.component.css']
})
export class JobComponent implements OnDestroy {
  jobs: BqJob[];
  paginatedJobs: BqJob[] = [];
  selectedProject: BqProject;
  planFile: File;
  readonly displayedColumns = ['btn', 'timestamp', 'id', 'state'];
  readonly pageSize = 10;
  readonly pageSizeOptions = [5, 10, 25, 100];
  pageEvent: PageEvent;  // from paginator
  private readonly destroy = new Subject<void>();

  // Emitted events.
  @Output() planSelected = new EventEmitter<BqQueryPlan>();

  constructor(
      private planService: QueryPlanService, private logSvc: LogService,
      private router: Router, private bqService: BigQueryService) {}

  ngOnDestroy() {
    this.destroy.next();
  }

  openInput() {
    // You can use ElementRef for this later.
    document.getElementById('fileInput').click();
  }

  fileChange(files: File[]) {
    if (files.length > 0) {
      this.planFile = files[0];
      this.logSvc.debug(' file changed');
    }
  }

  async upload() {
    this.logSvc.debug(' uploading...');
    const plan = await this.planService.upload(this.planFile);
    this.logSvc.debug(' uploading. complete');
    this.planSelected.emit(plan);
  }

  /**
   * Event handler called when the 'list jobs' button in the Project component
   * is clicked.
   */
  getJobs(project: BqProject) {
    this.jobs = [];
    this.selectedProject = project;
    this.bqService.getJobs(project.id)
        .pipe(takeUntil(this.destroy))
        .subscribe(
            res => {
              // this.logSvc.debug('job received from Bq Api');
              this.jobs.push(res);
            },
            err => {
              this.logSvc.error(err);
              if (err && err.message) {
                alert(err.message)
              }
              console.log(err);
            },
            () => {
              this.updatePaginatedJobs(
                  this.pageSize, this.pageEvent ? this.pageEvent.pageIndex : 0);
            });
  }

  // -------------  interacting with the Jobs grid ------------

  /** When selecting an item in the drop down list. */
  selectJob(job: BqJob): void {
    this.bqService.getQueryPlan(job.projectId, job.id)
        .pipe(takeUntil(this.destroy))
        .subscribe(
            detail => {
              console.log('Got raw plan', detail);
              this.planSelected.emit(new BqQueryPlan(detail, this.logSvc));
            },
            err => {
              this.logSvc.error(err);
            });
  }

  switchPage(event: PageEvent) {
    this.pageEvent = event;
    this.updatePaginatedJobs(event.pageSize, event.pageIndex);
  }

  updatePaginatedJobs(pageSize: number, pageIndex: number): void {
    this.paginatedJobs =
        this.jobs.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  }
}
