'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AiFillHome } from 'react-icons/ai';
import { IoBagAddSharp } from 'react-icons/io5';
import { BsFillPeopleFill } from 'react-icons/bs';
import { FaMoneyCheck } from 'react-icons/fa6';
import { BiSolidBank } from 'react-icons/bi';
import './styles/navstyle.css';

const NAV_ITEMS = [
  { name: 'Home', href: '/', icon: AiFillHome },
  { name: 'Installment', href: '/installments', icon: IoBagAddSharp },
  { name: 'Customers', href: '/customers', icon: BsFillPeopleFill },
  { name: 'Cashing', href: '/cashing', icon: FaMoneyCheck },
  { name: 'Bank', href: '/bank', icon: BiSolidBank },
];

export default function Navbar() {
  const pathname = usePathname();
  const activeIndex = NAV_ITEMS.findIndex((item) => item.href === pathname);

  return (
    <>
      {/* Desktop navbar */}
      <nav className="navbar-desktop">
        <Link href="/" className="navbar-logo">
          <Image
            src="/logo/logo.png"
            alt="Logo"
            width={48}
            height={48}
            className="navbar-logo-img"
            priority
          />
        </Link>

        <div
          className="navbar-nav-wrap"
          style={{ '--active-index': activeIndex }}
        >
          {activeIndex > -1 && <div className="navbar-indicator" />}
          <ul className="navbar-links">
            {NAV_ITEMS.map(({ name, href, icon: Icon }, i) => {
              const isActive = i === activeIndex;
              return (
                <li key={name}>
                  <Link
                    href={href}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="nav-icon" />
                    <span className="nav-label">{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile floating dock */}
      <nav className="navbar-mobile">
        <ul className="navbar-mobile-links">
          {NAV_ITEMS.map(({ name, href, icon: Icon }, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={name}>
                <Link
                  href={href}
                  className={`nav-item-mobile ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon-mobile-wrap">
                    <Icon className="nav-icon-mobile" />
                  </span>
                  <span className="nav-label-mobile">{name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
