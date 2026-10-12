import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TEXTOS } from './shared/textos';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly textos = TEXTOS.cursos;
}
