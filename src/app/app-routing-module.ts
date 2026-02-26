import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin';
import { RegisterComponent } from './register';
import { LandingComponent } from './landing';
import { RsvpViewComponent } from './rsvp-view';
import { MemoriesComponent } from './memories';

const routes: Routes = [
  { path: 'admin', component: AdminComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'rsvp/:slug', component: RsvpViewComponent },
  { path: ':slug/memories', component: MemoriesComponent },
  { path: '', component: LandingComponent, pathMatch: 'full' },
  { path: ':slug', component: LandingComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
