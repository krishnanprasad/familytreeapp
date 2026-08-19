import {
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { GuidedTreeInput, Gender, TreeNode, TreeSummary } from '../models/tree-node.model';
import { AuthService, AuthUser } from '../services/auth.service';
import { TreeService } from '../services/tree.service';

type OnboardingStep = 0 | 1 | 2;

interface ArchivePerson {
  name: string;
  role: string;
  monogram: string;
}

interface ArchiveStory {
  id: string;
  category: string;
  title: string;
  era: string;
  place: string;
  hook: string;
  relationship: string;
  accent: string;
  people: [ArchivePerson, ArchivePerson, ArchivePerson];
}

interface DiscoveryCategory {
  title: string;
  description: string;
  icon: string;
  count: string;
  branches: DiscoveryBranch[];
}

interface DiscoveryBranch {
  title: string;
  kicker: string;
  frame: string;
  insight: string;
  storyIndex: number;
  moments: DiscoveryMoment[];
}

interface DiscoveryMoment {
  title: string;
  label: string;
  detail: string;
}

interface RollingFamily {
  id: string;
  name: string;
  category: string;
  caption: string;
  photo: string;
  storyIndex: number;
  birthDate?: string;
  deathDate?: string;
  sourceLabel?: string;
  generatedTreeId?: GeneratedArchiveTreeId;
}

type GeneratedArchiveTreeId =
  | 'ambani'
  | 'windsor'
  | 'sachin-tendulkar'
  | 'akkineni'
  | 'karunanidhi'
  | 'rama'
  | 'arjuna'
  | 'kapoor'
  | 'tata'
  | 'curie';

interface ArchiveSearchOption {
  kind: 'generated' | 'public';
  title: string;
  subtitle: string;
  badge: string;
  searchText: string;
  generatedTreeId?: GeneratedArchiveTreeId;
  summary?: TreeSummary;
}

export interface GeneratedTreeRequest {
  tree: TreeNode;
  focusNodeId: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './onboarding.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnboardingComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() complete = new EventEmitter<GuidedTreeInput>();
  @Output() manual = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() generatedTreeRequested = new EventEmitter<GeneratedTreeRequest>();
  @Output() publicTreeRequested = new EventEmitter<TreeSummary>();

  @ViewChild('stepHeading') private stepHeading?: ElementRef<HTMLElement>;
  @ViewChild('archiveScene') private archiveScene?: ElementRef<HTMLElement>;

  private readonly verifiedPersonDateOverrides: Record<string, { birthDate?: string; deathDate?: string }> = {
    'Dhirubhai Ambani': { deathDate: '2002-07-06' },
    'Ratan Tata': { deathDate: '2024-10-09' },
    'JRD Tata': { deathDate: '1993-11-29' },
    'Steve Jobs': { deathDate: '2011-10-05' },
    'Mary Kom': { birthDate: '1983-03-01' },
    'Milkha Singh': { deathDate: '2021-06-18' },
    'Pelé': { deathDate: '2022-12-29' },
    'Walt Disney': { deathDate: '1966-12-15' },
    Sridevi: { deathDate: '2018-02-24' },
    'N. T. Rama Rao': { deathDate: '1996-01-18' },
    'M. G. Ramachandran': { deathDate: '1987-12-24' },
    'Bruce Lee': { deathDate: '1973-07-20' },
    'Marilyn Monroe': { deathDate: '1962-08-04' },
    'Ranbir Kapoor': { birthDate: '1982-09-28' },
    'Elizabeth II': { deathDate: '2022-09-08' },
    'Diana, Princess of Wales': { deathDate: '1997-08-31' },
    'Jawaharlal Nehru': { deathDate: '1964-05-27' },
    'Indira Gandhi': { deathDate: '1984-10-31' },
    'Mahatma Gandhi': { deathDate: '1948-01-30' },
    'Nelson Mandela': { deathDate: '2013-12-05' },
    'Abraham Lincoln': { deathDate: '1865-04-15' },
    'Winston Churchill': { deathDate: '1965-01-24' },
    'Albert Einstein': { deathDate: '1955-04-18' },
    'Marie Curie': { deathDate: '1934-07-04' },
    'Isaac Newton': { deathDate: '1727-03-20' },
    'Nikola Tesla': { deathDate: '1943-01-07' },
    'Stephen Hawking': { deathDate: '2018-03-14' },
    'A. P. J. Abdul Kalam': { deathDate: '2015-07-27' },
    'Srinivasa Ramanujan': { deathDate: '1920-04-26' },
    'Ada Lovelace': { deathDate: '1852-11-27' },
    'Alan Turing': { deathDate: '1954-06-07' },
    'Michael Jackson': { deathDate: '2009-06-25' },
    'Elvis Presley': { deathDate: '1977-08-16' },
    'Lata Mangeshkar': { deathDate: '2022-02-06' },
    'A. R. Rahman': { birthDate: '1967-01-06' },
    Ilaiyaraaja: { birthDate: '1943-06-03' }
  };

  readonly featuredStories: ArchiveStory[] = [
    {
      id: 'windsor',
      category: 'Kingdoms',
      title: 'House of Windsor',
      era: 'A modern royal house',
      place: 'United Kingdom',
      hook: 'Follow the marriages, successions and personal choices behind a public dynasty.',
      relationship: 'A sovereign line becomes a human family story.',
      accent: '#e0b86a',
      people: [
        { name: 'George V', role: 'The house begins', monogram: 'GV' },
        { name: 'Elizabeth II', role: 'Granddaughter', monogram: 'EII' },
        { name: 'Charles III', role: 'Son', monogram: 'CIII' }
      ]
    },
    {
      id: 'kapoor',
      category: 'Cinema',
      title: 'The Kapoor family',
      era: 'Generations on screen',
      place: 'India',
      hook: 'See how a creative legacy travelled through generations of Indian cinema.',
      relationship: 'One family, many eras of storytelling.',
      accent: '#d88972',
      people: [
        { name: 'Prithviraj', role: 'Pioneer', monogram: 'PK' },
        { name: 'Raj', role: 'Son', monogram: 'RK' },
        { name: 'Ranbir', role: 'Great-grandson', monogram: 'RK' }
      ]
    },
    {
      id: 'williams',
      category: 'Sport',
      title: 'The Williams family',
      era: 'A sporting sisterhood',
      place: 'United States',
      hook: 'Explore the family relationships behind two extraordinary tennis journeys.',
      relationship: 'A shared beginning. Two singular careers.',
      accent: '#70c5a5',
      people: [
        { name: 'Richard', role: 'Father', monogram: 'RW' },
        { name: 'Venus', role: 'Daughter', monogram: 'VW' },
        { name: 'Serena', role: 'Daughter', monogram: 'SW' }
      ]
    },
    {
      id: 'curie',
      category: 'Science',
      title: 'The Curie family',
      era: 'A scientific legacy',
      place: 'Poland and France',
      hook: 'Trace a family in which curiosity, partnership and discovery crossed generations.',
      relationship: 'Knowledge becomes part of a family inheritance.',
      accent: '#7fb7dc',
      people: [
        { name: 'Marie', role: 'Scientist', monogram: 'MC' },
        { name: 'Pierre', role: 'Partner', monogram: 'PC' },
        { name: 'Irene', role: 'Daughter', monogram: 'IJ' }
      ]
    },
    {
      id: 'tata',
      category: 'Enterprise',
      title: 'The Tata family',
      era: 'Industry and institution',
      place: 'India',
      hook: 'Move through a family story shaped by enterprise, stewardship and public purpose.',
      relationship: 'Ideas outlive a generation when others carry them forward.',
      accent: '#9c91dc',
      people: [
        { name: 'Jamsetji', role: 'Founder', monogram: 'JT' },
        { name: 'Dorabji', role: 'Son', monogram: 'DT' },
        { name: 'J. R. D.', role: 'Relative', monogram: 'JRD' }
      ]
    }
  ];

  readonly rollingFamilies: RollingFamily[] = [
    {
      id: 'ambani-roll',
      name: 'Ambani family',
      category: 'Enterprise',
      caption: 'Business, succession and the scale of modern Indian industry.',
      photo: this.commonsImage('Mukesh_Ambani.jpg'),
      storyIndex: 4,
      generatedTreeId: 'ambani'
    },
    {
      id: 'windsor-roll',
      name: 'Elizabeth family',
      category: 'Kingdoms',
      caption: 'A royal house seen through crown, duty and generations.',
      photo: this.commonsImage('Queen_Elizabeth2.jpg'),
      storyIndex: 0,
      generatedTreeId: 'windsor'
    },
    {
      id: 'tendulkar-roll',
      name: 'Sachin Tendulkar family',
      category: 'Sport',
      caption: 'The home, discipline and support behind a cricket legend.',
      photo: this.commonsImage('Sachin_Tendulkar.jpg'),
      storyIndex: 2,
      generatedTreeId: 'sachin-tendulkar'
    },
    {
      id: 'akkineni-roll',
      name: 'Naga Chaitanya family',
      category: 'Cinema',
      caption: 'A Telugu cinema lineage moving across generations.',
      photo: this.commonsImage('Naga_Chaitanya,_Nagarjuna_and_Amala.jpg'),
      storyIndex: 1,
      generatedTreeId: 'akkineni'
    },
    {
      id: 'karunanidhi-roll',
      name: 'Karunanidhi family',
      category: 'Politics',
      caption: 'Tamil public life, writing and political inheritance.',
      photo: this.commonsImage('Kalaignar_M._Karunanidhi.jpg'),
      storyIndex: 0,
      generatedTreeId: 'karunanidhi'
    },
    {
      id: 'rama-roll',
      name: 'God Ram family',
      category: 'Epic',
      caption: 'Lineage, exile, dharma and the story of Ayodhya.',
      photo: this.commonsImage('Lord_Rama_with_arrows.jpg'),
      storyIndex: 0,
      generatedTreeId: 'rama'
    },
    {
      id: 'arjuna-roll',
      name: 'Mahabharath Arjuna family',
      category: 'Epic',
      caption: 'The Pandava thread, duty and a war remembered through kinship.',
      photo: this.commonsImage('Krishna_and_Arjun_on_the_chariot,_Mahabharata,_18th-19th_century,_India.jpg'),
      storyIndex: 0,
      generatedTreeId: 'arjuna'
    },
    {
      id: 'kapoor-roll',
      name: 'Kapoor family',
      category: 'Cinema',
      caption: 'A screen dynasty where craft became inheritance.',
      photo: this.commonsImage('Kapoor_in_Moscow.jpg'),
      storyIndex: 1,
      generatedTreeId: 'kapoor'
    },
    {
      id: 'tata-roll',
      name: 'Tata family',
      category: 'Enterprise',
      caption: 'Founders, stewardship and institutions beyond one lifetime.',
      photo: this.commonsImage('Ratan_J._Tata.jpg'),
      storyIndex: 4,
      generatedTreeId: 'tata'
    },
    {
      id: 'curie-roll',
      name: 'Curie family',
      category: 'Science',
      caption: 'A laboratory story of partnership, discovery and legacy.',
      photo: this.commonsImage('Marie_et_Pierre_Curie.jpg'),
      storyIndex: 3,
      generatedTreeId: 'curie'
    }
  ];

  readonly verifiedPublicScrollerPeople: RollingFamily[] = [
    this.verifiedPerson(0, 'Mukesh Ambani', 'Enterprise', '1957-04-19', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mukesh%20Ambani.jpg'),
    this.verifiedPerson(1, 'Dhirubhai Ambani', 'Enterprise', '1932-12-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Dhirubhai%20Ambani%202002%20stamp%20of%20India.jpg'),
    this.verifiedPerson(2, 'Ratan Tata', 'Enterprise', '1937-12-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ratan%20Naval%20Tata%20in%202011.jpg'),
    this.verifiedPerson(3, 'JRD Tata', 'Enterprise', '1904-07-29', 'https://commons.wikimedia.org/wiki/Special:FilePath/J.R.D.%20Tata%20%281955%29.jpg'),
    this.verifiedPerson(4, 'Azim Premji', 'Enterprise', '1945-07-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Azim%20Premji%20-%20World%20Economic%20Forum%20Annual%20Meeting%20Davos%202009%20%28crop%29.jpg'),
    this.verifiedPerson(5, 'Gautam Adani', 'Enterprise', '1962-06-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Gautam%20Adani.jpg'),
    this.verifiedPerson(6, 'Shiv Nadar', 'Enterprise', '1945-07-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/Shiv%20Nadar%2C%20Founder%2C%20HCL%20and%20Chairman%2C%20HCL%20Technologies%2C%20with%20Sir%20Richard%20Stagg%2C%20British%20High%20Commissioner%20to%20India%2012%20October%202009.jpg'),
    this.verifiedPerson(7, 'Nandan Nilekani', 'Enterprise', '1955-06-02', 'https://commons.wikimedia.org/wiki/Special:FilePath/Nandan%20M.%20Nilekani.jpg'),
    this.verifiedPerson(8, 'Kiran Mazumdar-Shaw', 'Enterprise', '1953-03-23', 'https://commons.wikimedia.org/wiki/Special:FilePath/Kiran%20Mazumdar-Shaw%20HD2014%20crop.jpg'),
    this.verifiedPerson(9, 'Bill Gates', 'Enterprise', '1955-10-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Bill%20Gates%20at%20the%20European%20Commission%20-%202025%20-%20P067383-987995%20%28cropped%29.jpg'),
    this.verifiedPerson(10, 'Steve Jobs', 'Enterprise', '1955-02-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Steve%20Jobs%20Headshot%202010-CROP2.jpg'),
    this.verifiedPerson(11, 'Elon Musk', 'Enterprise', '1971-06-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Elon%20Musk%20%2854816836217%29%20%28cropped%202%29%20%28b%29.jpg'),
    this.verifiedPerson(12, 'Jeff Bezos', 'Enterprise', '1964-01-12', 'https://commons.wikimedia.org/wiki/Special:FilePath/Jeff%20Bezos%20at%20Amazon%20Spheres%20Grand%20Opening%20in%20Seattle%20-%202018%20%2839074799225%29%20%28cropped%29.jpg'),
    this.verifiedPerson(13, 'Warren Buffett', 'Enterprise', '1930-08-30', 'https://commons.wikimedia.org/wiki/Special:FilePath/Warren%20Buffett%20KU%20Visit.jpg'),
    this.verifiedPerson(14, 'Mark Zuckerberg', 'Enterprise', '1984-05-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mark%20Zuckerberg%20F8%202019%20Keynote%20%2832830578717%29%20%28cropped%29.jpg'),
    this.verifiedPerson(15, 'Larry Page', 'Enterprise', '1973-03-26', 'https://commons.wikimedia.org/wiki/Special:FilePath/Larry%20Page%20in%20the%20European%20Parliament%2C%2017.06.2009.jpg'),
    this.verifiedPerson(16, 'Sergey Brin', 'Enterprise', '1973-08-21', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sergey%20Brin%20Ted%202010%20%28cropped%29.jpg'),
    this.verifiedPerson(17, 'Oprah Winfrey', 'Enterprise', '1954-01-29', 'https://commons.wikimedia.org/wiki/Special:FilePath/Pre%20Inaugural%20Reception%20%2852639556983%29%20%28cropped%29.jpg'),
    this.verifiedPerson(18, 'Walt Disney', 'Enterprise', '1901-12-05', 'https://commons.wikimedia.org/wiki/Special:FilePath/Walt%20Disney%201946.JPG'),
    this.verifiedPerson(19, 'Bernard Arnault', 'Enterprise', '1949-03-05', 'https://commons.wikimedia.org/wiki/Special:FilePath/Bernard%20Arnault%20%283%29%20-%202017%20%28cropped%29.jpg'),
    this.verifiedPerson(20, 'Aliko Dangote', 'Enterprise', '1957-04-10', 'https://commons.wikimedia.org/wiki/Special:FilePath/Al%20Shabani%20at%20the%20acquisition%20of%20Dangote%20Cement%20by%20ICD%20in%202014%20%28cropped%29.jpg'),
    this.verifiedPerson(21, 'Sachin Tendulkar', 'Sport', '1973-04-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sachin%20at%20Castrol%20Golden%20Spanner%20Awards%20%28crop%29.jpg'),
    this.verifiedPerson(22, 'Virat Kohli', 'Sport', '1988-11-05', 'https://commons.wikimedia.org/wiki/Special:FilePath/Virat%20Kohli%20during%20the%20India%20vs%20Aus%204th%20Test%20match%20at%20Narendra%20Modi%20Stadium%20on%2009%20March%202023.jpg'),
    this.verifiedPerson(23, 'Rohit Sharma', 'Sport', '1987-04-30', 'https://commons.wikimedia.org/wiki/Special:FilePath/Rohit%20Sharma%20in%20PMO%20New%20Delhi.jpg'),
    this.verifiedPerson(24, 'Kapil Dev', 'Sport', '1959-01-06', 'https://commons.wikimedia.org/wiki/Special:FilePath/Kapil%20Dev%20at%20Equation%20sports%20auction.jpg'),
    this.verifiedPerson(25, 'Sunil Gavaskar', 'Sport', '1949-07-10', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sunny%20Gavaskar%20Sahara.jpg'),
    this.verifiedPerson(26, 'Neeraj Chopra', 'Sport', '1997-12-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Chopra%20Neeraj%202022.jpg'),
    this.verifiedPerson(27, 'Mary Kom', 'Sport', '1982-03-01', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mary%20Kom%20-%20British%20High%20Commission%2C%20Delhi%2C%2027%20July%202011.jpg'),
    this.verifiedPerson(28, 'Milkha Singh', 'Sport', '1929-11-20', 'https://commons.wikimedia.org/wiki/Special:FilePath/Milkha%20Singh.jpg'),
    this.verifiedPerson(29, 'Cristiano Ronaldo', 'Sport', '1985-02-05', 'https://commons.wikimedia.org/wiki/Special:FilePath/Cristiano%20Ronaldo%20Croatia%20v%20Portugal%202%20July%202026-075%20%28cropped%29.jpg'),
    this.verifiedPerson(30, 'Lionel Messi', 'Sport', '1987-06-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/Leo%20Messi%20Argentina%20v%20Egypt%207%20July%202026-1.jpg'),
    this.verifiedPerson(31, 'Serena Williams', 'Sport', '1981-09-26', 'https://commons.wikimedia.org/wiki/Special:FilePath/Serena%20Williams%20at%202013%20US%20Open.jpg'),
    this.verifiedPerson(32, 'Venus Williams', 'Sport', '1980-06-17', 'https://commons.wikimedia.org/wiki/Special:FilePath/Venus%20Williams%20%2814948553428%29.jpg'),
    this.verifiedPerson(33, 'Roger Federer', 'Sport', '1981-08-08', 'https://commons.wikimedia.org/wiki/Special:FilePath/Federer%20WM16%20%2837%29%20%2828136155830%29.jpg'),
    this.verifiedPerson(34, 'Rafael Nadal', 'Sport', '1986-06-03', 'https://commons.wikimedia.org/wiki/Special:FilePath/Rafael%20Nadal%20en%202024%20%28cropped%29.jpg'),
    this.verifiedPerson(35, 'Usain Bolt', 'Sport', '1986-08-21', 'https://commons.wikimedia.org/wiki/Special:FilePath/Usain%20Bolt%20Rio%20100m%20final%202016k.jpg'),
    this.verifiedPerson(36, 'Michael Jordan', 'Sport', '1963-02-17', 'https://commons.wikimedia.org/wiki/Special:FilePath/Michael%20Jordan%20in%202014.jpg'),
    this.verifiedPerson(37, 'LeBron James', 'Sport', '1984-12-30', 'https://commons.wikimedia.org/wiki/Special:FilePath/LeBron%20James%20%2851959977144%29%20%28cropped2%29.jpg'),
    this.verifiedPerson(38, 'Pelé', 'Sport', '1940-10-23', 'https://commons.wikimedia.org/wiki/Special:FilePath/Pele%20con%20brasil%20%28cropped%29.jpg'),
    this.verifiedPerson(39, 'Novak Djokovic', 'Sport', '1987-05-22', 'https://commons.wikimedia.org/wiki/Special:FilePath/Novak%20Djokovic%20Paris%202024%20Olympic%20Games%20%28cropped%29.jpg'),
    this.verifiedPerson(40, 'Michael Schumacher', 'Sport', '1969-01-03', 'https://commons.wikimedia.org/wiki/Special:FilePath/Michael%20Schumacher%2C%20September%202005.jpg'),
    this.verifiedPerson(41, 'Amitabh Bachchan', 'Cinema', '1942-10-11', 'https://commons.wikimedia.org/wiki/Special:FilePath/Indian%20actor%20Amitabh%20Bachchan.jpg'),
    this.verifiedPerson(42, 'Rajinikanth', 'Cinema', '1950-12-12', 'https://commons.wikimedia.org/wiki/Special:FilePath/Rajinikanth%20Felicitates%20Writer%20Kalaignanam.jpg'),
    this.verifiedPerson(43, 'Kamal Haasan', 'Cinema', '1954-11-07', 'https://commons.wikimedia.org/wiki/Special:FilePath/Kamal%20at%2061st%20FF%20%28cropped%29.jpg'),
    this.verifiedPerson(44, 'Shah Rukh Khan', 'Cinema', '1965-11-02', 'https://commons.wikimedia.org/wiki/Special:FilePath/Shah%20Rukh%20Khan%20graces%20the%20launch%20of%20the%20new%20Santro.jpg'),
    this.verifiedPerson(45, 'Aamir Khan', 'Cinema', '1965-03-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/Aamir%20Khan%20%28Berlin%20Film%20Festival%202011%29.jpg'),
    this.verifiedPerson(46, 'Salman Khan', 'Cinema', '1965-12-27', 'https://commons.wikimedia.org/wiki/Special:FilePath/Salmanrampwalk.png'),
    this.verifiedPerson(47, 'Akshay Kumar', 'Cinema', '1967-09-09', 'https://commons.wikimedia.org/wiki/Special:FilePath/Akshay%20Kumar.jpg'),
    this.verifiedPerson(48, 'Hrithik Roshan', 'Cinema', '1974-01-10', 'https://commons.wikimedia.org/wiki/Special:FilePath/Hrithik%20at%20Rado%20launch.jpg'),
    this.verifiedPerson(49, 'Ranbir Kapoor', 'Cinema', '1982-09-25', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ranbir%20Kapoor%20snapped%20at%20Kalina%20airport.jpg'),
    this.verifiedPerson(50, 'Deepika Padukone', 'Cinema', '1986-01-05', 'https://commons.wikimedia.org/wiki/Special:FilePath/Deepika%20Padukone%202025%20%281%29.png'),
    this.verifiedPerson(51, 'Priyanka Chopra', 'Cinema', '1982-07-18', 'https://commons.wikimedia.org/wiki/Special:FilePath/Priyanka%20Chopra%20at%20Bulgary%20launch%2C%202024%20%28cropped%29.jpg'),
    this.verifiedPerson(52, 'Madhuri Dixit', 'Cinema', '1967-05-15', 'https://commons.wikimedia.org/wiki/Special:FilePath/Madhuri%20Dixit%20in%20November%202022.jpg'),
    this.verifiedPerson(53, 'Sridevi', 'Cinema', '1963-08-13', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sridevi.jpg'),
    this.verifiedPerson(54, 'N. T. Rama Rao', 'Cinema', '1923-05-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/N.%20T.%20Rama%20Rao%2C%201952.jpg'),
    this.verifiedPerson(55, 'M. G. Ramachandran', 'Cinema', '1917-01-17', 'https://commons.wikimedia.org/wiki/Special:FilePath/MGR%20portrait%2C%20from%202017%20Stamp.jpg'),
    this.verifiedPerson(56, 'Naga Chaitanya', 'Cinema', '1986-11-23', 'https://commons.wikimedia.org/wiki/Special:FilePath/Naga%20Chaitanya%20at%20CBL%20Telugu%20Thunders%20team%20jersey%20launch.jpg'),
    this.verifiedPerson(57, 'Akkineni Nagarjuna', 'Cinema', '1959-08-29', 'https://commons.wikimedia.org/wiki/Special:FilePath/Nagarjuna%20at%2062nd%20Filmfare%20awards%20south.jpg'),
    this.verifiedPerson(58, 'Chiranjeevi', 'Cinema', '1955-08-22', 'https://commons.wikimedia.org/wiki/Special:FilePath/The%20Senior%20Vice-Minister%20of%20Tourism%2C%20Japan%2C%20Mr.%20Hiroshi%20Kajiyama%20calls%20on%20the%20Minister%20of%20State%20%28Independent%20Charge%29%20for%20Tourism%2C%20Dr.%20K.%20Chiranjeevi%2C%20in%20New%20Delhi%20on%20February%2012%2C%202013%20%28cropped%29.jpg'),
    this.verifiedPerson(59, 'Pawan Kalyan', 'Cinema', '1971-09-02', 'https://commons.wikimedia.org/wiki/Special:FilePath/Shri%20Konidela%20Pawan%20Kalyan.jpg'),
    this.verifiedPerson(60, 'Tom Cruise', 'Cinema', '1962-07-03', 'https://commons.wikimedia.org/wiki/Special:FilePath/Tom%20Cruise%20at%2053rd%20Saturn%20Awards%202026-01.jpg'),
    this.verifiedPerson(61, 'Leonardo DiCaprio', 'Cinema', '1974-11-11', 'https://commons.wikimedia.org/wiki/Special:FilePath/Leonardo%20DiCaprio%20-%20BFI%20Southbank%203%20%28crop%29.jpg'),
    this.verifiedPerson(62, 'Brad Pitt', 'Cinema', '1963-12-18', 'https://commons.wikimedia.org/wiki/Special:FilePath/Brad%20Pitt-69858.jpg'),
    this.verifiedPerson(63, 'Angelina Jolie', 'Cinema', '1975-06-04', 'https://commons.wikimedia.org/wiki/Special:FilePath/Angelina%20Jolie-643531%20%28cropped%29.jpg'),
    this.verifiedPerson(64, 'Denzel Washington', 'Cinema', '1954-12-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Denzel%20Washington%20at%20the%202025%20Cannes%20Film%20Festival.jpg'),
    this.verifiedPerson(65, 'Morgan Freeman', 'Cinema', '1937-06-01', 'https://commons.wikimedia.org/wiki/Special:FilePath/Morgan%20Freeman%20at%20The%20Pentagon%20on%202%20August%202023%20-%20230802-D-PM193-3363%20%28cropped%29.jpg'),
    this.verifiedPerson(66, 'Jackie Chan', 'Cinema', '1954-04-07', 'https://commons.wikimedia.org/wiki/Special:FilePath/Jackie%20Chan%20-%202025%20Locarno%20Film%20Festival.jpg'),
    this.verifiedPerson(67, 'Bruce Lee', 'Cinema', '1940-11-27', 'https://commons.wikimedia.org/wiki/Special:FilePath/Bruce%20Lee%201973%20%28cropped%29.jpg'),
    this.verifiedPerson(68, 'Marilyn Monroe', 'Cinema', '1926-06-01', 'https://commons.wikimedia.org/wiki/Special:FilePath/Marilyn%20Monroe%20in%20How%20to%20Marry%20a%20Millionaire.jpg'),
    this.verifiedPerson(69, 'Emma Watson', 'Cinema', '1990-04-15', 'https://commons.wikimedia.org/wiki/Special:FilePath/Emma%20Watson%202013.jpg'),
    this.verifiedPerson(70, 'Elizabeth II', 'Leaders', '1926-04-21', 'https://commons.wikimedia.org/wiki/Special:FilePath/Queen%20Elizabeth%20II%20official%20portrait%20for%201959%20tour%20%28retouched%29%20%28cropped%29%20%283-to-4%20aspect%20ratio%29.jpg'),
    this.verifiedPerson(71, 'Charles III', 'Leaders', '1948-11-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/King%20Charles%20III%20%28July%202023%29.jpg'),
    this.verifiedPerson(72, 'Diana, Princess of Wales', 'Leaders', '1961-07-01', 'https://commons.wikimedia.org/wiki/Special:FilePath/Diana%2C%20Princess%20of%20Wales%201997%20%282%29%20%28cropped%29.jpg'),
    this.verifiedPerson(73, 'William, Prince of Wales', 'Leaders', '1982-06-21', 'https://commons.wikimedia.org/wiki/Special:FilePath/Prince%20of%20Wales%20in%20Normandy%202024.jpg'),
    this.verifiedPerson(74, 'Narendra Modi', 'Leaders', '1950-09-17', 'https://commons.wikimedia.org/wiki/Special:FilePath/Prime%20Minister%20Of%20Bharat%20Shri%20Narendra%20Damodardas%20Modi.jpg'),
    this.verifiedPerson(75, 'Jawaharlal Nehru', 'Leaders', '1889-11-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/Jawaharlal%20Nehru%2C%20circa%201925.jpg'),
    this.verifiedPerson(76, 'Indira Gandhi', 'Leaders', '1917-11-19', 'https://commons.wikimedia.org/wiki/Special:FilePath/Face%20detail%2C%20Premier%20Indira%20Gandhi%20%28Congrespartij%29%2C%20Bestanddeelnr%20929-0811%20%28cropped%29.jpg'),
    this.verifiedPerson(77, 'Mahatma Gandhi', 'Leaders', '1869-10-02', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mahatma-Gandhi%2C%20studio%2C%201931.jpg'),
    this.verifiedPerson(78, 'Nelson Mandela', 'Leaders', '1918-07-18', 'https://commons.wikimedia.org/wiki/Special:FilePath/Nelson%20Mandela%201994.jpg'),
    this.verifiedPerson(79, 'Barack Obama', 'Leaders', '1961-08-04', 'https://commons.wikimedia.org/wiki/Special:FilePath/President%20Barack%20Obama.jpg'),
    this.verifiedPerson(80, 'Abraham Lincoln', 'Leaders', '1809-02-12', 'https://commons.wikimedia.org/wiki/Special:FilePath/Abraham%20Lincoln%20O-77%20matte%20collodion%20print.jpg'),
    this.verifiedPerson(81, 'Winston Churchill', 'Leaders', '1874-11-30', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sir%20Winston%20Churchill%20-%2019086236948%20%28restored%29.jpg'),
    this.verifiedPerson(82, 'M. K. Stalin', 'Leaders', '1953-03-01', 'https://commons.wikimedia.org/wiki/Special:FilePath/Mkspicture.jpg'),
    this.verifiedPerson(83, 'Albert Einstein', 'Science', '1879-03-14', 'https://commons.wikimedia.org/wiki/Special:FilePath/Albert%20Einstein%20Head%20cleaned.jpg'),
    this.verifiedPerson(84, 'Marie Curie', 'Science', '1867-11-07', 'https://commons.wikimedia.org/wiki/Special:FilePath/Marie%20Curie%20%281900%29%20%28cropped%29.jpg'),
    this.verifiedPerson(85, 'Isaac Newton', 'Science', '1643-01-04', 'https://commons.wikimedia.org/wiki/Special:FilePath/GodfreyKneller-IsaacNewton-1689.jpg'),
    this.verifiedPerson(86, 'Nikola Tesla', 'Science', '1856-07-10', 'https://commons.wikimedia.org/wiki/Special:FilePath/Tesla%20circa%201890.jpeg'),
    this.verifiedPerson(87, 'Stephen Hawking', 'Science', '1942-01-08', 'https://commons.wikimedia.org/wiki/Special:FilePath/Relative%20time%20%282886233692%29%20%28Stephen%20Hawking%20cropped%29.jpg'),
    this.verifiedPerson(88, 'A. P. J. Abdul Kalam', 'Science', '1931-10-15', 'https://commons.wikimedia.org/wiki/Special:FilePath/A.%20P.%20J.%20Abdul%20Kalam.jpg'),
    this.verifiedPerson(89, 'Srinivasa Ramanujan', 'Science', '1887-12-22', 'https://commons.wikimedia.org/wiki/Special:FilePath/Srinivasa%20Ramanujan%20-%20OPC%20-%202%20%28cleaned%29.jpg'),
    this.verifiedPerson(90, 'Ada Lovelace', 'Science', '1815-12-10', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ada%20Byron%20daguerreotype%20by%20Antoine%20Claudet%201843%20or%201850%20-%20cropped.png'),
    this.verifiedPerson(91, 'Alan Turing', 'Science', '1912-06-23', 'https://commons.wikimedia.org/wiki/Special:FilePath/Alan%20Turing%20%281951%29%20%28crop%29.jpg'),
    this.verifiedPerson(92, 'Michael Jackson', 'Music', '1958-08-29', 'https://commons.wikimedia.org/wiki/Special:FilePath/Michael%20Jackson%201983%20%283x4%20cropped%29%20%28contrast%29.jpg'),
    this.verifiedPerson(93, 'Beyoncé', 'Music', '1981-09-04', 'https://commons.wikimedia.org/wiki/Special:FilePath/Beyonc%C3%A9%20-%20Tottenham%20Hotspur%20Stadium%20-%201st%20June%202023%20%2810%20of%20118%29%20%2852946364598%29%20%28best%20crop%29.jpg'),
    this.verifiedPerson(94, 'Elvis Presley', 'Music', '1935-01-08', 'https://commons.wikimedia.org/wiki/Special:FilePath/Elvis%20Presley%20Publicity%20Photo%20for%20The%20Trouble%20with%20Girls%201968.jpg'),
    this.verifiedPerson(95, 'Bob Dylan', 'Music', '1941-05-24', 'https://commons.wikimedia.org/wiki/Special:FilePath/DylanYoungKilkenny140719v2%20%2850%20of%2052%29%20%2852246124397%29%20%28cropped%29.jpg'),
    this.verifiedPerson(96, 'Madonna', 'Music', '1958-08-16', 'https://commons.wikimedia.org/wiki/Special:FilePath/MadonnaO2171023%20%2897%20of%20133%29%20%2853269593787%29%20%28cropped%29.jpg'),
    this.verifiedPerson(97, 'Lata Mangeshkar', 'Music', '1929-09-28', 'https://commons.wikimedia.org/wiki/Special:FilePath/Lata%20Mangeshkar%20-%20still%2029065%20crop.jpg'),
    this.verifiedPerson(98, 'A. R. Rahman', 'Music', '1966-01-06', 'https://commons.wikimedia.org/wiki/Special:FilePath/AR%20Rahman%20At%20The%20%E2%80%98Marvel%20Anthem%E2%80%99%20Launch.jpg'),
    this.verifiedPerson(99, 'Ilaiyaraaja', 'Music', '1943-06-02', 'https://commons.wikimedia.org/wiki/Special:FilePath/Ilaiyaraaja%20BHung.jpg')
  ];

  readonly rollingFamilyLoop: RollingFamily[] = [
    ...this.rollingFamilies,
    ...this.verifiedPublicScrollerPeople
  ].slice(0, 20);

  private readonly generatedArchiveOptions: ArchiveSearchOption[] = [
    {
      kind: 'generated',
      title: 'Ambani family',
      subtitle: 'Publicly known chart · Enterprise · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'ambani family mukesh dhirubhai nita anil akash isha anant enterprise business',
      generatedTreeId: 'ambani'
    },
    {
      kind: 'generated',
      title: 'Elizabeth family',
      subtitle: 'Publicly known chart · Windsor · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'elizabeth windsor royal family george vi elizabeth ii philip charles anne andrew edward',
      generatedTreeId: 'windsor'
    },
    {
      kind: 'generated',
      title: 'Sachin Tendulkar family',
      subtitle: 'Publicly known chart · Cricket · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'sachin tendulkar family cricket sport anjali sara arjun ramesh rajni ajit',
      generatedTreeId: 'sachin-tendulkar'
    },
    {
      kind: 'generated',
      title: 'Naga Chaitanya family',
      subtitle: 'Publicly known chart · Telugu cinema · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'naga chaitanya akkineni family nagarjuna nageswara rao akhil samantha cinema telugu',
      generatedTreeId: 'akkineni'
    },
    {
      kind: 'generated',
      title: 'Karunanidhi family',
      subtitle: 'Publicly known chart · Politics · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'karunanidhi family dmk mk stalin alagiri kanimozhi politics tamil nadu',
      generatedTreeId: 'karunanidhi'
    },
    {
      kind: 'generated',
      title: 'God Ram family',
      subtitle: 'Epic tradition chart · Ramayana · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'god ram rama family ramayana dasharatha kausalya sita lava kusha ayodhya',
      generatedTreeId: 'rama'
    },
    {
      kind: 'generated',
      title: 'Mahabharath Arjuna family',
      subtitle: 'Epic tradition chart · Mahabharata · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'arjuna family mahabharata pandu kunti subhadra abhimanyu pandava',
      generatedTreeId: 'arjuna'
    },
    {
      kind: 'generated',
      title: 'Kapoor family',
      subtitle: 'Publicly known chart · Cinema · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'kapoor family prithviraj raj rishi randhir ranbir kareena karisma bollywood cinema',
      generatedTreeId: 'kapoor'
    },
    {
      kind: 'generated',
      title: 'Tata family',
      subtitle: 'Publicly known chart · Enterprise · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'tata family jamsetji dorabji ratanji jrd ratan enterprise',
      generatedTreeId: 'tata'
    },
    {
      kind: 'generated',
      title: 'Curie family',
      subtitle: 'Publicly known chart · Science · opens in the tree workspace',
      badge: 'Computer Generated',
      searchText: 'curie family marie pierre irene eve science nobel',
      generatedTreeId: 'curie'
    }
  ];

  readonly discoveryCategories: DiscoveryCategory[] = [
    {
      title: 'Kingdoms & dynasties',
      description: 'Succession, alliance and the people behind an era.',
      icon: 'landmark',
      count: 'Royal houses',
      branches: [
        this.branch('The crown changes hands', 'Succession', 'A ruler exits. Three heirs, promises and pressures enter the frame.', 'Power becomes personal when the next name appears.', 0),
        this.branch('Marriage as map', 'Alliance', 'One wedding can redraw borders, loyalties and the future of a house.', 'The romance is only the first scene.', 0),
        this.branch('The exile returns', 'Restoration', 'A family leaves the palace, then history asks whether the name can return.', 'Memory can become a claim.', 0)
      ]
    },
    {
      title: 'Cinema & stage',
      description: 'Creative families whose work crossed generations.',
      icon: 'clapperboard',
      count: 'Screen legacies',
      branches: [
        this.branch('First shot', 'Origin scene', 'A performer steps on stage and begins a surname the audience will remember.', 'A craft becomes inheritance.', 1),
        this.branch('The second generation', 'Rising act', 'The child of a legend must decide whether to repeat, rebel or reinvent.', 'Legacy is pressure with applause.', 1),
        this.branch('A new camera angle', 'Modern frame', 'A later generation carries the name into a changed industry.', 'The family name survives by changing shape.', 1)
      ]
    },
    {
      title: 'Sporting families',
      description: 'Talent, rivalry and support inside remarkable teams.',
      icon: 'trophy',
      count: 'Athletic stories',
      branches: [
        this.branch('The backyard drill', 'Training ground', 'Before the stadium, there is a parent, a sibling and a repeated routine.', 'Greatness often starts very quietly.', 2),
        this.branch('Siblings under lights', 'Rivalry', 'Two people share a home, then meet the world as separate champions.', 'Competition can be a family language.', 2),
        this.branch('The impossible season', 'Breakthrough', 'A family bet becomes public proof that the dream was not fantasy.', 'Belief becomes visible only after years of work.', 2)
      ]
    },
    {
      title: 'Founders & business',
      description: 'How enterprise and responsibility moved through families.',
      icon: 'briefcase-business',
      count: 'Business houses',
      branches: [
        this.branch('The first factory light', 'Beginning', 'Someone risks the family name on an idea no one can fully see yet.', 'A company starts as a personal wager.', 4),
        this.branch('Stewards after the founder', 'Continuity', 'The next generation inherits more than ownership: workers, reputation and duty.', 'Success is what survives the founder.', 4),
        this.branch('Institution over ego', 'Public purpose', 'A family enterprise turns into schools, hospitals, trusts and national memory.', 'The deeper story is what the wealth served.', 4)
      ]
    },
    {
      title: 'Science & discovery',
      description: 'The homes, partnerships and mentors behind new ideas.',
      icon: 'atom',
      count: 'Curious minds',
      branches: [
        this.branch('The shared laboratory', 'Partnership', 'Two minds work side by side until discovery becomes a family chapter.', 'Some breakthroughs are relational.', 3),
        this.branch('The daughter continues', 'Inheritance', 'A child grows up near questions large enough to become her own work.', 'Curiosity can be passed down.', 3),
        this.branch('The prize and the cost', 'Recognition', 'Fame enters the family, but the work still asks for sacrifice.', 'Achievement has a private price.', 3)
      ]
    },
    {
      title: 'Music & art',
      description: 'Traditions taught, challenged and reinvented over time.',
      icon: 'palette',
      count: 'Creative lineages',
      branches: [
        this.branch('The house of practice', 'Training', 'A child learns rhythm, brushwork or voice before they can name ambition.', 'Technique is often family memory.', 1),
        this.branch('Breaking the style', 'Reinvention', 'The next artist keeps the lineage alive by refusing to copy it.', 'Respect can look like rebellion.', 1),
        this.branch('The work outlives them', 'Archive', 'Objects, recordings and stories become the bridge to later generations.', 'Art is how a family keeps speaking.', 1)
      ]
    },
    {
      title: 'Politics & movements',
      description: 'Public lives understood through private relationships.',
      icon: 'scale',
      count: 'Civic families',
      branches: [
        this.branch('The private room', 'Conviction', 'A public decision begins as a conversation at home.', 'Movements have dinner tables too.', 0),
        this.branch('The name enters history', 'Public life', 'A family member becomes a symbol, and the household becomes part of the record.', 'The public face has private roots.', 0),
        this.branch('After the speech', 'Consequence', 'The next generation inherits reputation, risk and unfinished work.', 'History rarely ends at the podium.', 0)
      ]
    },
    {
      title: 'Migration & culture',
      description: 'Where families began, travelled and made a new home.',
      icon: 'route',
      count: 'Journeys across place',
      branches: [
        this.branch('The place left behind', 'Origin', 'A name begins in one landscape before war, work or hope moves it elsewhere.', 'Every journey starts with a loss and a choice.', 4),
        this.branch('The crossing', 'Journey', 'Documents, languages and memory travel together into a new life.', 'Migration is a family story in motion.', 4),
        this.branch('The new surname sound', 'Arrival', 'Children grow up between what was kept and what had to change.', 'Culture survives by becoming local.', 4)
      ]
    }
  ];

  step: OnboardingStep = 0;
  selectedStoryIndex = 0;
  activeDiscoveryIndex: number | null = null;
  activeDiscoveryBranchIndex = 0;
  activeDiscoveryMomentIndex = 0;
  discoveryDepth = 0;
  archiveQuery = '';
  archiveSearchStatus = '';
  publicTreeSuggestions: TreeSummary[] = [];
  publicTreeSearchLoaded = false;
  publicTreeSearchLoading = false;
  searchDropdownOpen = false;
  familyRollPaused = false;
  selfAttempted = false;
  reducedMotion = false;
  googleUser: AuthUser | null = null;
  googleSignInBusy = false;
  googleSignInError = '';
  joinedWithGoogle = false;

  form: {
    selfName: string;
    selfGender: Gender;
    selfBirthDate: string;
    selfLocation: string;
    parentOneName: string;
    parentTwoName: string;
    siblings: string;
    partnerName: string;
    children: string;
  } = {
    selfName: '',
    selfGender: Gender.OTHER,
    selfBirthDate: '',
    selfLocation: '',
    parentOneName: '',
    parentTwoName: '',
    siblings: '',
    partnerName: '',
    children: ''
  };

  private motionPreference?: MediaQueryList;
  private sceneFrame?: number;
  private readonly destroy$ = new Subject<void>();
  private readonly googleFastJoinStorageKey = 'myFamilyTree_onboardingGoogle_v1';
  private resumeGoogleFastJoin = false;
  private readonly handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    if (event.matches) this.resetScenePosition();
  };

  constructor(
    private readonly treeService: TreeService,
    private readonly authService: AuthService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resumeGoogleFastJoin = this.hasPendingGoogleFastJoin();

    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) this.googleUser = user;
        else if (!this.joinedWithGoogle) this.googleUser = null;
        if (user && (!this.form.selfName.trim() || this.resumeGoogleFastJoin)) {
          this.applyGoogleIdentity(user);
        }
        if (user && this.resumeGoogleFastJoin) {
          this.clearPendingGoogleFastJoin();
          this.setStep(2);
        }
        this.changeDetector.markForCheck();
      });

    this.authService.authReady$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ready => {
        if (!ready || !this.resumeGoogleFastJoin || this.authService.currentUser) return;
        this.clearPendingGoogleFastJoin();
        this.googleSignInBusy = false;
        this.googleSignInError = 'Google sign-in did not finish. Please try again.';
        this.changeDetector.markForCheck();
      });
  }

  get selectedStory(): ArchiveStory {
    return this.featuredStories[this.selectedStoryIndex];
  }

  get activeDiscoveryCategory(): DiscoveryCategory | null {
    return this.activeDiscoveryIndex === null ? null : this.discoveryCategories[this.activeDiscoveryIndex];
  }

  get activeDiscoveryBranch(): DiscoveryBranch | null {
    return this.activeDiscoveryCategory?.branches[this.activeDiscoveryBranchIndex] ?? null;
  }

  get activeDiscoveryMoment(): DiscoveryMoment | null {
    return this.activeDiscoveryBranch?.moments[this.activeDiscoveryMomentIndex] ?? null;
  }

  get filledNameCount(): number {
    return [this.form.selfName, this.form.parentOneName, this.form.parentTwoName]
      .filter(name => name.trim()).length;
  }

  get primaryLabel(): string {
    if (this.step === 1) return 'Continue to my family';
    if (this.filledNameCount >= 3) return 'Create my three-name tree';
    return 'Open my family tree';
  }

  get archiveSearchOptions(): ArchiveSearchOption[] {
    const query = this.archiveQuery.trim().toLowerCase();
    const publicOptions = this.publicTreeSuggestions.map(summary => ({
      kind: 'public' as const,
      title: summary.treeName,
      subtitle: `${summary.treeOwnerName} · ${summary.personCount || 'Public'} people`,
      badge: 'Public tree',
      searchText: [
        summary.treeName,
        summary.treeOwnerName,
        summary.ownerEmail,
        summary.branchRootName
      ].filter(Boolean).join(' ').toLowerCase(),
      summary
    }));

    return [...this.generatedArchiveOptions, ...publicOptions]
      .filter(option => !query || option.searchText.includes(query) || option.title.toLowerCase().includes(query))
      .slice(0, 7);
  }

  get archiveSearchDropdownVisible(): boolean {
    return this.searchDropdownOpen && (this.archiveSearchOptions.length > 0 || this.publicTreeSearchLoading);
  }

  ngAfterViewInit(): void {
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionPreference.matches;
    this.motionPreference.addEventListener('change', this.handleMotionPreference);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.motionPreference?.removeEventListener('change', this.handleMotionPreference);
    if (this.sceneFrame) cancelAnimationFrame(this.sceneFrame);
  }

  selectStory(index: number): void {
    this.selectedStoryIndex = index;
    this.archiveSearchStatus = `${this.featuredStories[index].title} selected.`;
  }

  openDiscovery(index: number): void {
    this.activeDiscoveryIndex = index;
    this.activeDiscoveryBranchIndex = 0;
    this.activeDiscoveryMomentIndex = 0;
    this.discoveryDepth = 1;
    this.selectStory(this.discoveryCategories[index].branches[0].storyIndex);
    window.setTimeout(() => this.scrollTo('story-tunnel'));
  }

  openDiscoveryBranch(index: number): void {
    const branch = this.activeDiscoveryCategory?.branches[index];
    if (!branch) return;
    this.activeDiscoveryBranchIndex = index;
    this.activeDiscoveryMomentIndex = 0;
    this.discoveryDepth = 2;
    this.selectStory(branch.storyIndex);
  }

  openDiscoveryMoment(index: number): void {
    if (!this.activeDiscoveryBranch?.moments[index]) return;
    this.activeDiscoveryMomentIndex = index;
    this.discoveryDepth = 3;
  }

  openRollingFamily(family: RollingFamily): void {
    this.familyRollPaused = true;

    if (family.generatedTreeId) {
      this.openGeneratedArchiveTree(family.generatedTreeId);
      return;
    }

    this.selectStory(family.storyIndex);
    this.archiveSearchStatus = `${family.name} opened from the rolling archive.`;
    this.scrollTo('featured-archive');
  }

  pauseFamilyRoll(): void {
    this.familyRollPaused = true;
  }

  resumeFamilyRoll(): void {
    this.familyRollPaused = false;
  }

  onArchiveSearchFocus(): void {
    this.searchDropdownOpen = true;
    void this.loadPublicTreeSuggestions();
  }

  onArchiveSearchInput(): void {
    this.searchDropdownOpen = true;
    void this.loadPublicTreeSuggestions();
  }

  onArchiveSearchBlur(): void {
    window.setTimeout(() => {
      this.searchDropdownOpen = false;
      this.changeDetector.markForCheck();
    }, 140);
  }

  openArchiveOption(option: ArchiveSearchOption): void {
    this.searchDropdownOpen = false;
    this.archiveQuery = option.title;

    if (option.kind === 'generated' && option.generatedTreeId) {
      this.openGeneratedArchiveTree(option.generatedTreeId);
      return;
    }

    if (option.kind === 'public' && option.summary) {
      this.archiveSearchStatus = `Opening public tree: ${option.summary.treeName}.`;
      this.publicTreeRequested.emit(option.summary);
    }
  }

  submitArchiveSearch(): void {
    const query = this.archiveQuery.trim().toLowerCase();
    if (!query) {
      this.archiveSearchStatus = 'Enter a person, family, dynasty or category.';
      return;
    }

    const generatedOption = this.generatedArchiveOptions.find(option =>
      option.searchText.includes(query) || option.title.toLowerCase().includes(query)
    );
    if (generatedOption?.generatedTreeId) {
      this.openGeneratedArchiveTree(generatedOption.generatedTreeId);
      return;
    }

    const publicOption = this.archiveSearchOptions.find(option => option.kind === 'public');
    if (publicOption) {
      this.openArchiveOption(publicOption);
      return;
    }

    const storyIndex = this.featuredStories.findIndex(story =>
      [story.title, story.category, story.place, story.hook]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );

    if (storyIndex >= 0) {
      this.selectStory(storyIndex);
      this.scrollTo('featured-archive');
      return;
    }

    this.archiveSearchStatus = `“${this.archiveQuery.trim()}” is not in this preview yet. Try Windsor, Kapoor, Williams, Curie or Tata.`;
  }

  scrollTo(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: this.reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  startGuidedSetup(): void {
    this.setStep(1);
  }

  async continueWithGoogle(): Promise<void> {
    if (this.googleSignInBusy) return;

    if (this.googleUser) {
      this.applyGoogleIdentity(this.googleUser);
      this.setStep(2);
      return;
    }

    this.googleSignInBusy = true;
    this.googleSignInError = '';
    this.changeDetector.markForCheck();

    try {
      if (this.authService.shouldUseRedirectSignIn) {
        this.storePendingGoogleFastJoin();
        await this.authService.signInWithGoogleRedirect();
        return;
      }

      const user = await this.authService.signInWithGooglePopup();
      this.applyGoogleIdentity(user);
      this.setStep(2);
    } catch (error) {
      if (this.shouldFallbackToGoogleRedirect(error)) {
        this.storePendingGoogleFastJoin();
        await this.authService.signInWithGoogleRedirect();
        return;
      }
      console.error('Onboarding Google sign-in failed:', error);
      this.googleSignInError = this.googleErrorMessage(error);
    } finally {
      this.googleSignInBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  advance(): void {
    if (this.step === 0) {
      this.startGuidedSetup();
      return;
    }

    if (this.step === 1) {
      this.selfAttempted = true;
      if (!this.form.selfName.trim()) return;
      this.setStep(2);
      return;
    }

    this.finish();
  }

  back(): void {
    if (this.step === 2) {
      this.setStep(1);
      return;
    }

    this.setStep(0);
  }

  returnToArchive(): void {
    this.setStep(0);
  }

  finish(): void {
    this.selfAttempted = true;
    if (!this.form.selfName.trim()) {
      this.setStep(1);
      return;
    }

    const payload: GuidedTreeInput = {
      selfName: this.form.selfName.trim(),
      selfGender: this.form.selfGender,
      selfBirthDate: this.optionalText(this.form.selfBirthDate),
      selfLocation: this.optionalText(this.form.selfLocation),
      selfPhotoUrl: this.joinedWithGoogle ? this.googleUser?.photoURL ?? undefined : undefined,
      parentOneName: this.optionalText(this.form.parentOneName),
      parentTwoName: this.optionalText(this.form.parentTwoName),
      siblingNames: this.nameList(this.form.siblings),
      partnerName: this.optionalText(this.form.partnerName),
      childNames: this.nameList(this.form.children)
    };

    this.complete.emit(payload);
  }

  onScenePointerMove(event: PointerEvent): void {
    if (this.reducedMotion || !this.archiveScene) return;
    const scene = this.archiveScene.nativeElement;
    const bounds = scene.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    if (this.sceneFrame) cancelAnimationFrame(this.sceneFrame);
    this.sceneFrame = requestAnimationFrame(() => {
      scene.style.setProperty('--scene-x', `${x * 8}deg`);
      scene.style.setProperty('--scene-y', `${y * -6}deg`);
      scene.style.setProperty('--light-x', `${50 + x * 18}%`);
      scene.style.setProperty('--light-y', `${44 + y * 14}%`);
    });
  }

  resetScenePosition(): void {
    const scene = this.archiveScene?.nativeElement;
    if (!scene) return;
    scene.style.setProperty('--scene-x', '0deg');
    scene.style.setProperty('--scene-y', '0deg');
    scene.style.setProperty('--light-x', '50%');
    scene.style.setProperty('--light-y', '44%');
  }

  trackStory(_index: number, story: ArchiveStory): string {
    return story.id;
  }

  trackCategory(_index: number, category: DiscoveryCategory): string {
    return category.title;
  }

  trackBranch(_index: number, branch: DiscoveryBranch): string {
    return branch.title;
  }

  trackMoment(_index: number, moment: DiscoveryMoment): string {
    return moment.title;
  }

  trackRollingFamily(index: number, family: RollingFamily): string {
    return `${family.id}-${index}`;
  }

  private verifiedPerson(index: number, name: string, category: string, birthDate: string, photo: string): RollingFamily {
    const override = this.verifiedPersonDateOverrides[name] ?? {};
    const resolvedBirthDate = override.birthDate ?? birthDate;
    const resolvedDeathDate = override.deathDate;
    const sourceLabel = resolvedDeathDate || override.birthDate ? 'Dates verified' : 'DOB verified';
    const verifiedWhat = resolvedDeathDate ? 'birth and death dates' : 'DOB';

    return {
      id: `verified-${index}-${this.slugText(name)}`,
      name,
      category,
      birthDate: resolvedBirthDate,
      deathDate: resolvedDeathDate,
      sourceLabel,
      caption: `${this.categoryScrollerCaption(category)} Public profile with ${verifiedWhat} cross-checked before saving.`,
      photo,
      storyIndex: this.storyIndexForScrollerCategory(category)
    };
  }

  private categoryScrollerCaption(category: string): string {
    const captions: Record<string, string> = {
      Enterprise: 'Founder, builder or business icon.',
      Sport: 'Champion, competitor or sporting legacy.',
      Cinema: 'Film artist, performer or screen legend.',
      Leaders: 'Public life, monarchy or political leadership.',
      Science: 'Discovery, invention or intellectual legacy.',
      Music: 'Voice, rhythm and creative influence.'
    };
    return captions[category] ?? 'Public figure in the living archive.';
  }

  private storyIndexForScrollerCategory(category: string): number {
    const indices: Record<string, number> = {
      Enterprise: 4,
      Sport: 2,
      Cinema: 1,
      Leaders: 0,
      Science: 3,
      Music: 1
    };
    return indices[category] ?? 0;
  }

  private slugText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'person';
  }

  private branch(title: string, kicker: string, frame: string, insight: string, storyIndex: number): DiscoveryBranch {
    return {
      title,
      kicker,
      frame,
      insight,
      storyIndex,
      moments: [
        { title: 'The person', label: 'Character', detail: 'Who made the choice, carried the name or changed the direction?' },
        { title: 'The bond', label: 'Relationship', detail: 'Who were they connected to, and what did that connection unlock?' },
        { title: 'The echo', label: 'Legacy', detail: 'What still travels forward because this moment happened?' }
      ]
    };
  }

  private commonsImage(fileName: string): string {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
  }

  private setStep(step: OnboardingStep): void {
    this.step = step;
    this.changeDetector.markForCheck();
    window.setTimeout(() => {
      document.querySelector('.onboarding-backdrop')?.scrollTo({ top: 0 });
      this.stepHeading?.nativeElement.focus();
    });
  }

  private applyGoogleIdentity(user: AuthUser): void {
    const accountName = user.displayName?.trim()
      || user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    if (accountName) this.form.selfName = accountName;
    this.googleUser = user;
    this.googleSignInBusy = false;
    this.googleSignInError = '';
    this.joinedWithGoogle = true;
  }

  private storePendingGoogleFastJoin(): void {
    this.resumeGoogleFastJoin = true;
    sessionStorage.setItem(this.googleFastJoinStorageKey, JSON.stringify({ startedAt: Date.now() }));
  }

  private hasPendingGoogleFastJoin(): boolean {
    const stored = sessionStorage.getItem(this.googleFastJoinStorageKey);
    if (!stored) return false;

    try {
      const parsed = JSON.parse(stored) as { startedAt?: unknown };
      const startedAt = Number(parsed.startedAt);
      if (!Number.isFinite(startedAt) || Date.now() - startedAt > 120000) {
        sessionStorage.removeItem(this.googleFastJoinStorageKey);
        return false;
      }
      return true;
    } catch {
      sessionStorage.removeItem(this.googleFastJoinStorageKey);
      return false;
    }
  }

  private clearPendingGoogleFastJoin(): void {
    this.resumeGoogleFastJoin = false;
    sessionStorage.removeItem(this.googleFastJoinStorageKey);
  }

  private shouldFallbackToGoogleRedirect(error: unknown): boolean {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    return code === 'auth/popup-blocked'
      || code === 'auth/operation-not-supported-in-this-environment'
      || code === 'auth/web-storage-unsupported';
  }

  private googleErrorMessage(error: unknown): string {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled. You can still continue with your name.';
    if (code === 'auth/unauthorized-domain') return 'Google sign-in is not available on this domain yet.';
    return 'Google sign-in could not start. Please try again or continue with your name.';
  }

  private optionalText(value: string): string | undefined {
    const cleanValue = value.trim();
    return cleanValue || undefined;
  }

  private async loadPublicTreeSuggestions(): Promise<void> {
    if (this.publicTreeSearchLoaded || this.publicTreeSearchLoading) return;
    this.publicTreeSearchLoading = true;
    this.changeDetector.markForCheck();

    try {
      this.publicTreeSuggestions = await this.treeService.loadPublicTreeSummaries();
      this.publicTreeSearchLoaded = true;
    } catch (error) {
      console.warn('Could not load public tree suggestions:', error);
      this.archiveSearchStatus = 'Public tree search is temporarily unavailable. Generated examples still work.';
    } finally {
      this.publicTreeSearchLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  private openGeneratedArchiveTree(treeId: GeneratedArchiveTreeId): void {
    const request = this.createGeneratedArchiveTree(treeId);
    this.archiveSearchStatus = `Opening ${request.tree.treeName ?? request.tree.name}. Computer generated from publicly known details.`;
    this.generatedTreeRequested.emit(request);
  }

  private createGeneratedArchiveTree(treeId: GeneratedArchiveTreeId): GeneratedTreeRequest {
    switch (treeId) {
      case 'ambani': return { tree: this.createAmbaniTree(), focusNodeId: 'generated-mukesh-ambani' };
      case 'windsor': return { tree: this.createWindsorTree(), focusNodeId: 'generated-elizabeth-ii' };
      case 'akkineni': return { tree: this.createAkkineniTree(), focusNodeId: 'generated-naga-chaitanya' };
      case 'karunanidhi': return { tree: this.createKarunanidhiTree(), focusNodeId: 'generated-karunanidhi' };
      case 'rama': return { tree: this.createRamaTree(), focusNodeId: 'generated-rama' };
      case 'arjuna': return { tree: this.createArjunaTree(), focusNodeId: 'generated-arjuna' };
      case 'kapoor': return { tree: this.createKapoorTree(), focusNodeId: 'generated-ranbir-kapoor' };
      case 'tata': return { tree: this.createTataTree(), focusNodeId: 'generated-jamsetji-tata' };
      case 'curie': return { tree: this.createCurieTree(), focusNodeId: 'generated-marie-curie' };
      case 'sachin-tendulkar':
      default:
        return { tree: this.createSachinTendulkarTree(), focusNodeId: 'generated-sachin-tendulkar' };
    }
  }

  private generatedPerson(id: string, name: string, gender: Gender, extra: Partial<TreeNode> = {}): TreeNode {
    const generatedTags = ['Computer Generated', 'Publicly known', 'Verify before publishing'];
    return {
      id,
      treeName: extra.treeName,
      treeOwnerName: extra.treeOwnerName,
      name,
      gender,
      age: extra.age ?? 0,
      location: extra.location ?? '',
      isAlive: extra.isAlive ?? true,
      type: extra.type ?? 'blood',
      spouse: extra.spouse ?? null,
      children: extra.children ?? [],
      alternateNames: extra.alternateNames ?? [],
      tags: [...generatedTags, ...(extra.tags ?? [])],
      stories: extra.stories ?? [],
      events: extra.events ?? [],
      parentRelationshipType: extra.parentRelationshipType,
      partnerRelationshipType: extra.partnerRelationshipType,
      relationshipRecords: extra.relationshipRecords,
      birthDate: extra.birthDate,
      deathDate: extra.deathDate,
      birthPlace: extra.birthPlace,
      photoUrl: extra.photoUrl,
      notes: extra.notes
    };
  }

  private createAmbaniTree(): TreeNode {
    const mukesh = this.generatedPerson('generated-mukesh-ambani', 'Mukesh Ambani', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1957-04-19',
      photoUrl: this.commonsImage('Mukesh_Ambani.jpg')
    });
    mukesh.spouse = this.generatedPerson('generated-nita-ambani', 'Nita Ambani', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1963-11-01'
    });
    const akash = this.generatedPerson('generated-akash-ambani', 'Akash Ambani', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1991-10-23' });
    akash.spouse = this.generatedPerson('generated-shloka-mehta', 'Shloka Mehta', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      notes: 'Publicly known spouse of Akash Ambani.'
    });
    const isha = this.generatedPerson('generated-isha-ambani', 'Isha Ambani', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1991-10-23' });
    isha.spouse = this.generatedPerson('generated-anand-piramal', 'Anand Piramal', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1985-10-25',
      notes: 'Publicly known spouse of Isha Ambani.'
    });
    const anant = this.generatedPerson('generated-anant-ambani', 'Anant Ambani', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1995-04-10' });
    anant.spouse = this.generatedPerson('generated-radhika-merchant', 'Radhika Merchant', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      notes: 'Publicly known spouse of Anant Ambani.'
    });
    mukesh.children = [akash, isha, anant];
    const anil = this.generatedPerson('generated-anil-ambani', 'Anil Ambani', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1959-06-04'
    });
    anil.spouse = this.generatedPerson('generated-tina-ambani', 'Tina Ambani', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1958-02-11'
    });
    const root = this.generatedPerson('generated-dhirubhai-ambani', 'Dhirubhai Ambani', Gender.MALE, {
      treeName: 'Ambani Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1932-12-28',
      deathDate: '2002-07-06',
      isAlive: false,
      photoUrl: this.commonsImage('Dhirubhai_Ambani_2002_stamp_of_India.jpg')
    });
    root.spouse = this.generatedPerson('generated-kokilaben-ambani', 'Kokilaben Ambani', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1934-02-24'
    });
    root.children = [mukesh, anil];
    return root;
  }

  private createWindsorTree(): TreeNode {
    const elizabeth = this.generatedPerson('generated-elizabeth-ii', 'Elizabeth II', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1926-04-21',
      deathDate: '2022-09-08',
      isAlive: false,
      photoUrl: this.commonsImage('Queen_Elizabeth2.jpg')
    });
    elizabeth.spouse = this.generatedPerson('generated-prince-philip', 'Prince Philip', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1921-06-10',
      deathDate: '2021-04-09',
      isAlive: false
    });
    const charles = this.generatedPerson('generated-charles-iii', 'Charles III', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1948-11-14' });
    charles.spouse = this.generatedPerson('generated-queen-camilla', 'Queen Camilla', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1947-07-17'
    });
    const anne = this.generatedPerson('generated-princess-anne', 'Anne, Princess Royal', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1950-08-15' });
    anne.spouse = this.generatedPerson('generated-timothy-laurence', 'Timothy Laurence', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1955-03-01'
    });
    const andrew = this.generatedPerson('generated-prince-andrew', 'Prince Andrew', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1960-02-19' });
    const edward = this.generatedPerson('generated-prince-edward', 'Prince Edward', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1964-03-10' });
    edward.spouse = this.generatedPerson('generated-sophie-rhys-jones', 'Sophie, Duchess of Edinburgh', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1965-01-20'
    });
    elizabeth.children = [charles, anne, andrew, edward];
    const root = this.generatedPerson('generated-george-vi', 'George VI', Gender.MALE, {
      treeName: 'Elizabeth / Windsor Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1895-12-14',
      deathDate: '1952-02-06',
      isAlive: false
    });
    root.spouse = this.generatedPerson('generated-elizabeth-bowes-lyon', 'Elizabeth Bowes-Lyon', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1900-08-04',
      deathDate: '2002-03-30',
      isAlive: false
    });
    root.children = [elizabeth, this.generatedPerson('generated-princess-margaret', 'Princess Margaret', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1930-08-21',
      deathDate: '2002-02-09',
      isAlive: false
    })];
    return root;
  }

  private createAkkineniTree(): TreeNode {
    const nagarjuna = this.generatedPerson('generated-nagarjuna', 'Akkineni Nagarjuna', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1959-08-29',
      photoUrl: this.commonsImage('Nagarjuna_at_62nd_Filmfare_awards_south.jpg'),
      notes: 'Publicly known father of Naga Chaitanya with Lakshmi Daggubati and of Akhil with Amala Akkineni.'
    });
    nagarjuna.spouse = this.generatedPerson('generated-amala-akkineni', 'Amala Akkineni', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1967-09-12',
      notes: 'Publicly known spouse of Nagarjuna; stepmother to Naga Chaitanya.'
    });
    const nagaChaitanya = this.generatedPerson('generated-naga-chaitanya', 'Naga Chaitanya', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1986-11-23',
      notes: 'Publicly known son of Nagarjuna and Lakshmi Daggubati; shown here in the public preview branch.'
    });
    nagaChaitanya.spouse = this.generatedPerson('generated-sobhita-dhulipala', 'Sobhita Dhulipala', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1992-05-31',
      notes: 'Publicly known spouse of Naga Chaitanya.'
    });
    nagarjuna.children = [
      nagaChaitanya,
      this.generatedPerson('generated-akhil-akkineni', 'Akhil Akkineni', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1994-04-08',
        notes: 'Publicly known son of Nagarjuna and Amala Akkineni.'
      })
    ];
    const root = this.generatedPerson('generated-nageswara-rao', 'Akkineni Nageswara Rao', Gender.MALE, {
      treeName: 'Akkineni / Naga Chaitanya Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1924-09-20',
      deathDate: '2014-01-22',
      isAlive: false,
      notes: 'Public preview chart; keeps the line focused on the publicly known Nagarjuna / Naga Chaitanya branch.'
    });
    root.children = [nagarjuna];
    return root;
  }

  private createKarunanidhiTree(): TreeNode {
    const dateNotPublic = 'Exact date is not publicly documented in reliable public sources.';

    const muthu = this.generatedPerson('generated-mk-muthu', 'M. K. Muthu', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1948-01-14',
      deathDate: '2025-07-19',
      isAlive: false,
      notes: 'Only child of M. Karunanidhi and Padmavathi Ammal; actor and singer.'
    });
    muthu.spouse = this.generatedPerson('generated-sivagamisundari-muthu', 'Sivagamisundari', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      notes: 'Publicly documented spouse of M. K. Muthu.'
    });
    const thenmozhi = this.generatedPerson('generated-thenmozhi-muthu', 'Thenmozhi', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      notes: 'Publicly documented daughter of M. K. Muthu; exact birth date not public.'
    });
    thenmozhi.spouse = this.generatedPerson('generated-ck-ranganathan', 'C. K. Ranganathan', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    thenmozhi.children = [
      this.generatedPerson('generated-manu-ranjith', 'Manu Ranjith', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly documented son of Thenmozhi and C. K. Ranganathan; exact birth date not public.'
      })
    ];
    muthu.children = [
      this.generatedPerson('generated-arivunidhi-muthu', 'Arivunidhi', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Doctor and playback singer; exact birth date not public.'
      }),
      thenmozhi
    ];

    const alagiri = this.generatedPerson('generated-mk-alagiri', 'M. K. Alagiri', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1951-01-30',
      notes: 'Son of M. Karunanidhi and Dayalu Ammal; former Union Minister.'
    });
    alagiri.spouse = this.generatedPerson('generated-kanthi-alagiri', 'Kanthi Alagiri', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    const dayanidhiAzhagiri = this.generatedPerson('generated-dayanidhi-azhagiri', 'Dayanidhi Azhagiri', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      notes: 'Also known as Durai Dayanidhi; film producer and distributor. Exact birth date not public.'
    });
    dayanidhiAzhagiri.spouse = this.generatedPerson('generated-anusha-dayanidhi', 'Anusha Dayanidhi', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    alagiri.children = [
      dayanidhiAzhagiri,
      this.generatedPerson('generated-kayalvizhi-venkatesh', 'Kayalvizhi Venkatesh', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: dateNotPublic
      }),
      this.generatedPerson('generated-anjuga-selvi', 'Anjuga Selvi', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: dateNotPublic
      })
    ];

    const udhayanidhi = this.generatedPerson('generated-udhayanidhi-stalin', 'Udhayanidhi Stalin', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1977-11-27',
      notes: 'Son of M. K. Stalin and Durga Stalin; actor, producer and politician.'
    });
    udhayanidhi.spouse = this.generatedPerson('generated-kiruthiga-udhayanidhi', 'Kiruthiga Udhayanidhi', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
      ,
      birthDate: '1978-07-03'
    });
    udhayanidhi.children = [
      this.generatedPerson('generated-inbanithi-udhayanidhi', 'Inbanithi Udhayanidhi', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly documented child of Udhayanidhi and Kiruthiga; exact birth date not public.'
      }),
      this.generatedPerson('generated-tanmaya-udhayanidhi', 'Tanmaya Udhayanidhi', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly documented child of Udhayanidhi and Kiruthiga; exact birth date not public.'
      })
    ];
    const senthamarai = this.generatedPerson('generated-senthamarai-sabareesan', 'Senthamarai Sabareesan', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      notes: dateNotPublic
    });
    senthamarai.spouse = this.generatedPerson('generated-v-sabareesan', 'V. Sabareesan', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    senthamarai.children = [
      this.generatedPerson('generated-nilani-sabareesan', 'Nilani Sabareesan', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly named in news reports; exact birth date not public.'
      })
    ];
    const stalin = this.generatedPerson('generated-mk-stalin', 'M. K. Stalin', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1953-03-01',
      photoUrl: this.commonsImage('Mkspicture.jpg'),
      notes: 'Son of M. Karunanidhi and Dayalu Ammal; DMK president and major Tamil Nadu political leader.'
    });
    stalin.spouse = this.generatedPerson('generated-durga-stalin', 'Durga Stalin', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1955-03-12'
    });
    stalin.children = [udhayanidhi, senthamarai];

    const selvi = this.generatedPerson('generated-selvi-selvam', 'M. K. Selvi / Selvi Selvam', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      notes: 'Daughter of M. Karunanidhi and Dayalu Ammal; exact birth date not public.'
    });
    selvi.spouse = this.generatedPerson('generated-murasoli-selvam', 'Murasoli Selvam', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1940-04-24',
      deathDate: '2024-10-10',
      isAlive: false,
      notes: 'Brother of Murasoli Maran; also appears in the Maran branch.'
    });
    selvi.children = [
      this.generatedPerson('generated-ezhilarasi-jothimani', 'Ezhilarasi Jothimani', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Doctor and daughter of Selvi and Murasoli Selvam; exact birth date not public.'
      })
    ];

    const arulnithi = this.generatedPerson('generated-arulnithi-tamilarasu', 'Arulnithi Tamilarasu', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1987-07-21',
      notes: 'Son of M. K. Tamilarasu and Mohana; actor.'
    });
    arulnithi.spouse = this.generatedPerson('generated-keerthana-arulnithi', 'Keerthana', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    const tamilarasu = this.generatedPerson('generated-mk-tamilarasu', 'M. K. Tamilarasu', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      notes: 'Youngest son of M. Karunanidhi and Dayalu Ammal; exact birth date not strongly documented in reliable public sources.'
    });
    tamilarasu.spouse = this.generatedPerson('generated-mohana-tamilarasu', 'Mohana', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    tamilarasu.children = [
      arulnithi,
      this.generatedPerson('generated-poonguzhali-tamilarasu', 'Poonguzhali Tamilarasu', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: dateNotPublic
      })
    ];

    const kanimozhi = this.generatedPerson('generated-kanimozhi', 'Kanimozhi Karunanidhi', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1968-01-05',
      notes: 'Daughter of M. Karunanidhi and Rajathi Ammal; politician, poet and journalist.'
    });
    kanimozhi.spouse = this.generatedPerson('generated-g-aravindan', 'G. Aravindan', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    kanimozhi.children = [
      this.generatedPerson('generated-aditya-aravindan', 'Aditya Aravindan', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly documented son of Kanimozhi and G. Aravindan; exact birth date not public.'
      })
    ];

    const padmavathi = this.generatedPerson('generated-padmavathi-ammal', 'Padmavathi Ammal', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'former_spouse',
      deathDate: '1948',
      isAlive: false,
      notes: 'First wife of M. Karunanidhi. Public sources report she died in 1948 after M. K. Muthu was born; exact birth date is not public.'
    });
    padmavathi.children = [muthu];

    const dayalu = this.generatedPerson('generated-dayalu-ammal', 'Dayalu Ammal', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      notes: 'Second wife of M. Karunanidhi. Exact date of birth is not strongly documented in reliable public sources.'
    });
    dayalu.children = [alagiri, stalin, selvi, tamilarasu];

    const rajathi = this.generatedPerson('generated-rajathi-ammal', 'Rajathi Ammal', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'partner',
      notes: 'Third wife / companion of M. Karunanidhi. Reported birth year is around 1945, but exact date is not strongly documented.'
    });
    rajathi.children = [kanimozhi];

    const karunanidhi = this.generatedPerson('generated-karunanidhi', 'M. Karunanidhi', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1924-06-03',
      deathDate: '2018-08-07',
      isAlive: false,
      photoUrl: this.commonsImage('Kalaignar_M._Karunanidhi.jpg'),
      notes: 'Publicly known family chart. Spouse branches are shown separately so children stay under their publicly documented mother.',
      relationshipRecords: [
        { id: 'generated-karunanidhi-padmavathi', fromPersonId: 'generated-karunanidhi', toPersonId: 'generated-padmavathi-ammal', type: 'former_spouse', endDate: '1948' },
        { id: 'generated-karunanidhi-dayalu', fromPersonId: 'generated-karunanidhi', toPersonId: 'generated-dayalu-ammal', type: 'spouse' },
        { id: 'generated-karunanidhi-rajathi', fromPersonId: 'generated-karunanidhi', toPersonId: 'generated-rajathi-ammal', type: 'partner' }
      ],
      stories: [
        {
          id: 'generated-karunanidhi-source-note',
          title: 'Public source caution',
          text: 'Dates are included only where reliable public sources document them. Unknown birthdays are intentionally left blank instead of guessed.'
        }
      ]
    });
    karunanidhi.children = [padmavathi, dayalu, rajathi];

    const kalanithi = this.generatedPerson('generated-kalanithi-maran', 'Kalanithi Maran', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1964-07-24',
      notes: 'Founder of Sun Group and a key public figure in the Maran branch.'
    });
    kalanithi.spouse = this.generatedPerson('generated-kavery-maran', 'Kavery Maran', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    kalanithi.children = [
      this.generatedPerson('generated-kaviya-maran', 'Kaviya Maran', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1992-08-06',
        notes: 'Daughter of Kalanithi and Kavery Maran; public sports and media executive.'
      })
    ];
    const dayanidhiMaran = this.generatedPerson('generated-dayanidhi-maran', 'Dayanidhi Maran', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1966-12-05',
      notes: 'Son of Murasoli Maran and Mallika Maran; politician and MP.'
    });
    dayanidhiMaran.spouse = this.generatedPerson('generated-priya-maran', 'Priya Maran', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    dayanidhiMaran.children = [
      this.generatedPerson('generated-karan-maran', 'Karan Maran', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        notes: dateNotPublic
      }),
      this.generatedPerson('generated-divya-maran', 'Divya Maran', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: dateNotPublic
      })
    ];
    const murasoliMaran = this.generatedPerson('generated-murasoli-maran', 'Murasoli Maran', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1934-08-17',
      deathDate: '2003-11-23',
      isAlive: false,
      notes: 'Nephew of M. Karunanidhi; former Union Minister.'
    });
    murasoliMaran.spouse = this.generatedPerson('generated-mallika-maran', 'Mallika Maran', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    murasoliMaran.children = [
      kalanithi,
      dayanidhiMaran,
      this.generatedPerson('generated-anbukarasi-maran', 'Anbukarasi Maran', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        notes: 'Publicly documented daughter of Murasoli and Mallika Maran; exact birth date not public.'
      })
    ];

    const shanmugasundari = this.generatedPerson('generated-shanmugasundari', 'Shanmugasundari', Gender.FEMALE, {
      parentRelationshipType: 'biological_parent',
      isAlive: false,
      notes: 'Sister of M. Karunanidhi; mother of the Maran branch.'
    });
    shanmugasundari.children = [
      murasoliMaran,
      this.generatedPerson('generated-murasoli-selvam-branch', 'Murasoli Selvam', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1940-04-24',
        deathDate: '2024-10-10',
        isAlive: false,
        notes: 'Brother of Murasoli Maran and spouse of M. K. Selvi; exact birth date not public.'
      })
    ];

    const root = this.generatedPerson('generated-muthuvelar', 'Muthuvelar', Gender.MALE, {
      treeName: 'Karunanidhi Family',
      treeOwnerName: 'Computer Generated',
      isAlive: false,
      notes: 'Parent generation included so the Maran branch appears as Karunanidhi sibling-line kin, not as direct descendants.'
    });
    root.spouse = this.generatedPerson('generated-anjugam', 'Anjugam', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      isAlive: false
    });
    root.children = [karunanidhi, shanmugasundari];
    return root;
  }

  private createRamaTree(): TreeNode {
    const rama = this.generatedPerson('generated-rama', 'Rama', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      photoUrl: this.commonsImage('Lord_Rama_with_arrows.jpg'),
      notes: 'Epic tradition chart from the Ramayana; not a modern civil record.'
    });
    rama.spouse = this.generatedPerson('generated-sita', 'Sita', Gender.FEMALE, { type: 'spouse', partnerRelationshipType: 'spouse' });
    rama.children = [
      this.generatedPerson('generated-lava', 'Lava', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPerson('generated-kusha', 'Kusha', Gender.MALE, { parentRelationshipType: 'biological_parent' })
    ];
    const root = this.generatedPerson('generated-dasharatha', 'Dasharatha', Gender.MALE, {
      treeName: 'God Ram Family',
      treeOwnerName: 'Computer Generated',
      notes: 'Epic tradition chart from the Ramayana; not a modern civil record.'
    });
    root.spouse = this.generatedPerson('generated-kausalya', 'Kausalya', Gender.FEMALE, { type: 'spouse', partnerRelationshipType: 'spouse' });
    root.children = [
      rama,
      this.generatedPerson('generated-bharata', 'Bharata', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPerson('generated-lakshmana', 'Lakshmana', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPerson('generated-shatrughna', 'Shatrughna', Gender.MALE, { parentRelationshipType: 'biological_parent' })
    ];
    return root;
  }

  private createArjunaTree(): TreeNode {
    const arjuna = this.generatedPerson('generated-arjuna', 'Arjuna', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      photoUrl: this.commonsImage('Krishna_and_Arjun_on_the_chariot,_Mahabharata,_18th-19th_century,_India.jpg'),
      notes: 'Epic tradition chart from the Mahabharata; not a modern civil record.'
    });
    arjuna.spouse = this.generatedPerson('generated-subhadra', 'Subhadra', Gender.FEMALE, { type: 'spouse', partnerRelationshipType: 'spouse' });
    arjuna.children = [this.generatedPerson('generated-abhimanyu', 'Abhimanyu', Gender.MALE, { parentRelationshipType: 'biological_parent' })];
    const root = this.generatedPerson('generated-pandu', 'Pandu', Gender.MALE, {
      treeName: 'Mahabharath Arjuna Family',
      treeOwnerName: 'Computer Generated',
      notes: 'Epic tradition chart from the Mahabharata; not a modern civil record.'
    });
    root.spouse = this.generatedPerson('generated-kunti', 'Kunti', Gender.FEMALE, { type: 'spouse', partnerRelationshipType: 'spouse' });
    root.children = [
      this.generatedPerson('generated-yudhishthira', 'Yudhishthira', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPerson('generated-bhima', 'Bhima', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      arjuna,
      this.generatedPerson('generated-nakula', 'Nakula', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPerson('generated-sahadeva', 'Sahadeva', Gender.MALE, { parentRelationshipType: 'biological_parent' })
    ];
    return root;
  }

  private createKapoorTree(): TreeNode {
    const raj = this.generatedPerson('generated-raj-kapoor', 'Raj Kapoor', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1924-12-14',
      deathDate: '1988-06-02',
      isAlive: false,
      notes: 'Publicly known children: Randhir, Ritu, Rishi and Rajiv Kapoor.'
    });
    raj.spouse = this.generatedPerson('generated-krishna-kapoor', 'Krishna Kapoor', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1930-12-30',
      deathDate: '2018-10-01',
      isAlive: false
    });
    const randhir = this.generatedPerson('generated-randhir-kapoor', 'Randhir Kapoor', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1947-02-15'
    });
    randhir.spouse = this.generatedPerson('generated-babita-kapoor', 'Babita Kapoor', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1948-04-20'
    });
    const karisma = this.generatedPerson('generated-karisma-kapoor', 'Karisma Kapoor', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1974-06-25' });
    const kareena = this.generatedPerson('generated-kareena-kapoor', 'Kareena Kapoor', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1980-09-21' });
    kareena.spouse = this.generatedPerson('generated-saif-ali-khan', 'Saif Ali Khan', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1970-08-16'
    });
    randhir.children = [karisma, kareena];
    const rishi = this.generatedPerson('generated-rishi-kapoor', 'Rishi Kapoor', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1952-09-04',
      deathDate: '2020-04-30',
      isAlive: false
    });
    rishi.spouse = this.generatedPerson('generated-neetu-kapoor', 'Neetu Kapoor', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1958-07-08'
    });
    const riddhima = this.generatedPerson('generated-riddhima-kapoor', 'Riddhima Kapoor Sahni', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1980-09-15' });
    riddhima.spouse = this.generatedPerson('generated-bharat-sahni', 'Bharat Sahni', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      notes: 'Publicly known spouse of Riddhima Kapoor Sahni.'
    });
    const ranbir = this.generatedPerson('generated-ranbir-kapoor', 'Ranbir Kapoor', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1982-09-28' });
    ranbir.spouse = this.generatedPerson('generated-alia-bhatt', 'Alia Bhatt', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1993-03-15'
    });
    rishi.children = [riddhima, ranbir];
    const ritu = this.generatedPerson('generated-ritu-nanda', 'Ritu Nanda', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1948-10-30', deathDate: '2020-01-14', isAlive: false });
    raj.children = [
      randhir,
      rishi,
      ritu,
      this.generatedPerson('generated-rajiv-kapoor', 'Rajiv Kapoor', Gender.MALE, { parentRelationshipType: 'biological_parent', birthDate: '1962-08-25', deathDate: '2021-02-09', isAlive: false })
    ];
    const root = this.generatedPerson('generated-prithviraj-kapoor', 'Prithviraj Kapoor', Gender.MALE, {
      treeName: 'Kapoor Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1906-11-03',
      deathDate: '1972-05-29',
      isAlive: false,
      photoUrl: this.commonsImage('Kapoor_in_Moscow.jpg'),
      notes: 'Publicly known film-family branch centered on Raj Kapoor, Randhir Kapoor and Rishi Kapoor.'
    });
    root.children = [raj];
    return root;
  }

  private createTataTree(): TreeNode {
    const root = this.generatedPerson('generated-jamsetji-tata', 'Jamsetji Tata', Gender.MALE, {
      treeName: 'Tata Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1839-03-03',
      deathDate: '1904-05-19',
      isAlive: false,
      photoUrl: this.commonsImage('Jamsetji_Tata.jpg'),
      notes: 'Abbreviated public chart. J.R.D. Tata belongs to the R.D. Tata cousin branch and is not shown as a direct descendant here.'
    });
    const dorabji = this.generatedPerson('generated-dorabji-tata', 'Dorabji Tata', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1859-08-27',
      deathDate: '1932-06-03',
      isAlive: false
    });
    dorabji.spouse = this.generatedPerson('generated-meherbai-tata', 'Meherbai Tata', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1879-10-10',
      deathDate: '1931-06-18',
      isAlive: false
    });
    const ratan = this.generatedPerson('generated-ratanji-tata', 'Sir Ratan Tata', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1871-01-20',
      deathDate: '1918-09-05',
      isAlive: false,
      notes: 'Second son of Jamsetji Tata; fatherhood here is abbreviated to the public line that leads to Naval Tata.'
    });
    ratan.spouse = this.generatedPerson('generated-navajbai-tata', 'Lady Navajbai Tata', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1877-09-23',
      deathDate: '1965-08-20',
      isAlive: false
    });
    const naval = this.generatedPerson('generated-naval-tata', 'Naval Tata', Gender.MALE, {
      parentRelationshipType: 'adoptive_parent',
      birthDate: '1904-08-30',
      deathDate: '1989-05-05',
      isAlive: false,
      notes: 'Adopted into the Tata family by Lady Ratan Tata.'
    });
    naval.children = [
      this.generatedPerson('generated-ratan-tata', 'Ratan Tata', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1937-12-28',
        deathDate: '2024-10-09',
        isAlive: false,
        photoUrl: this.commonsImage('Ratan_Naval_Tata_in_2011.jpg')
      })
    ];
    ratan.children = [naval];
    root.children = [
      dorabji,
      ratan
    ];
    return root;
  }

  private createCurieTree(): TreeNode {
    const root = this.generatedPerson('generated-marie-curie', 'Marie Curie', Gender.FEMALE, {
      treeName: 'Curie Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1867-11-07',
      deathDate: '1934-07-04',
      isAlive: false,
      photoUrl: this.commonsImage('Marie_et_Pierre_Curie.jpg')
    });
    root.spouse = this.generatedPerson('generated-pierre-curie', 'Pierre Curie', Gender.MALE, { type: 'spouse', partnerRelationshipType: 'spouse', birthDate: '1859-05-15', deathDate: '1906-04-19', isAlive: false });
    const irene = this.generatedPerson('generated-irene-joliot-curie', 'Irène Joliot-Curie', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1897-09-12', deathDate: '1956-03-17', isAlive: false });
    irene.spouse = this.generatedPerson('generated-frederic-joliot-curie', 'Frédéric Joliot-Curie', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1900-03-19',
      deathDate: '1958-08-14',
      isAlive: false
    });
    const eve = this.generatedPerson('generated-eve-curie', 'Ève Curie', Gender.FEMALE, { parentRelationshipType: 'biological_parent', birthDate: '1904-12-06', deathDate: '2007-10-22', isAlive: false });
    eve.spouse = this.generatedPerson('generated-henry-labouisse', 'Henry Richardson Labouisse Jr.', Gender.MALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1904-02-11',
      deathDate: '1987-03-25',
      isAlive: false
    });
    root.children = [irene, eve];
    return root;
  }

  private createSachinTendulkarTree(): TreeNode {
    const generatedTags = ['Computer Generated', 'Publicly known', 'Verify before publishing'];
    const person = (id: string, name: string, gender: Gender, extra: Partial<TreeNode> = {}): TreeNode => ({
      id,
      treeName: extra.treeName,
      treeOwnerName: extra.treeOwnerName,
      name,
      gender,
      age: extra.age ?? 0,
      location: extra.location ?? '',
      isAlive: extra.isAlive ?? true,
      type: extra.type ?? 'blood',
      spouse: extra.spouse ?? null,
      children: extra.children ?? [],
      alternateNames: extra.alternateNames ?? [],
      tags: [...generatedTags, ...(extra.tags ?? [])],
      stories: extra.stories ?? [],
      events: extra.events ?? [],
      parentRelationshipType: extra.parentRelationshipType,
      partnerRelationshipType: extra.partnerRelationshipType,
      relationshipStartDate: extra.relationshipStartDate,
      relationshipEndDate: extra.relationshipEndDate,
      birthDate: extra.birthDate,
      deathDate: extra.deathDate,
      birthPlace: extra.birthPlace,
      photoUrl: extra.photoUrl,
      socialProfiles: extra.socialProfiles ?? [],
      notes: extra.notes
    });

    const sachin = person('generated-sachin-tendulkar', 'Sachin Tendulkar', Gender.MALE, {
      birthDate: '1973-04-24',
      birthPlace: 'Mumbai, India',
      location: 'Mumbai, India',
      photoUrl: this.commonsImage('Sachin_Tendulkar.jpg'),
      socialProfiles: [
        { platform: 'instagram', handle: 'sachintendulkar', isPublic: true },
        { platform: 'facebook', handle: 'SachinTendulkar', isPublic: true },
        { platform: 'x', handle: 'sachin_rt', isPublic: true },
        { platform: 'linkedin', handle: 'https://in.linkedin.com/in/sachinrtendulkar', isPublic: true }
      ],
      parentRelationshipType: 'biological_parent',
      notes: 'Computer generated profile based only on publicly known relationships.',
      stories: [
        {
          id: 'generated-sachin-source-note',
          title: 'Generated public-family note',
          text: 'Publicly known relationship summary: parents Ramesh and Rajni; siblings Nitin, Ajit and Savita; spouse Anjali; children Sara and Arjun.'
        }
      ],
      events: [
        {
          id: 'generated-sachin-birth',
          type: 'birth',
          title: 'Born in Mumbai',
          date: '1973-04-24',
          place: 'Mumbai, India'
        }
      ]
    });

    sachin.spouse = person('generated-anjali-tendulkar', 'Anjali Tendulkar', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1967-11-10',
      notes: 'Publicly known as Sachin Tendulkar’s wife; no private details added.'
    });
    const arjun = person('generated-arjun-tendulkar', 'Arjun Tendulkar', Gender.MALE, {
      parentRelationshipType: 'biological_parent',
      birthDate: '1999-09-24',
      notes: 'Publicly known child of Sachin and Anjali Tendulkar.'
    });
    arjun.spouse = person('generated-saaniya-chandhok', 'Saaniya Chandhok', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse',
      birthDate: '1998-06-23',
      notes: 'Publicly known spouse of Arjun Tendulkar as of March 5, 2026.'
    });
    sachin.children = [
      person('generated-sara-tendulkar', 'Sara Tendulkar', Gender.FEMALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1997-10-12',
        notes: 'Publicly known child of Sachin and Anjali Tendulkar.'
      }),
      arjun
    ];

    const root = person('generated-ramesh-tendulkar', 'Ramesh Tendulkar', Gender.MALE, {
      isAlive: false,
      treeName: 'Sachin Tendulkar Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1930-12-18',
      deathDate: '1999-05-19',
      notes: 'Generated public family chart. Please verify before reuse.'
    });
    root.spouse = person('generated-rajni-tendulkar', 'Rajni Tendulkar', Gender.FEMALE, {
      type: 'spouse',
      partnerRelationshipType: 'spouse'
    });
    root.children = [
      person('generated-nitin-tendulkar', 'Nitin Tendulkar', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      person('generated-ajit-tendulkar', 'Ajit Tendulkar', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      person('generated-savita-tendulkar', 'Savita Tendulkar', Gender.FEMALE, { parentRelationshipType: 'biological_parent' }),
      sachin
    ];

    return root;
  }

  private nameList(value: string): string[] | undefined {
    const names = value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    return names.length ? names : undefined;
  }
}
