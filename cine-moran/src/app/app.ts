import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavComponent } from './shared/nav/nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}