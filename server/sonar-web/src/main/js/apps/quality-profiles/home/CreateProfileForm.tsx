/*
 * SonarQube
 * Copyright (C) 2009-2022 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { sortBy } from 'lodash';
import * as React from 'react';
import {
  changeProfileParent,
  createQualityProfile,
  getImporters,
} from '../../../api/quality-profiles';
import { ResetButtonLink, SubmitButton } from '../../../components/controls/buttons';
import Modal from '../../../components/controls/Modal';
import Select from '../../../components/controls/Select';
import { Location } from '../../../components/hoc/withRouter';
import MandatoryFieldMarker from '../../../components/ui/MandatoryFieldMarker';
import MandatoryFieldsExplanation from '../../../components/ui/MandatoryFieldsExplanation';
import { translate } from '../../../helpers/l10n';
import { parseAsOptionalString } from '../../../helpers/query';
import { Profile } from '../types';

interface Props {
  languages: Array<{ key: string; name: string }>;
  location: Location;
  onClose: () => void;
  onCreate: Function;
  profiles: Profile[];
}

interface State {
  importers: Array<{ key: string; languages: Array<string>; name: string }>;
  language?: string;
  loading: boolean;
  name: string;
  parent?: string;
  preloading: boolean;
}

export default class CreateProfileForm extends React.PureComponent<Props, State> {
  mounted = false;
  state: State = { importers: [], loading: false, name: '', preloading: true };

  componentDidMount() {
    this.mounted = true;
    this.fetchImporters();
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchImporters() {
    getImporters().then(
      (importers) => {
        if (this.mounted) {
          this.setState({ importers, preloading: false });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ preloading: false });
        }
      }
    );
  }

  handleNameChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ name: event.currentTarget.value });
  };

  handleLanguageChange = (option: { value: string }) => {
    this.setState({ language: option.value });
  };

  handleParentChange = (option: { value: string } | null) => {
    this.setState({ parent: option ? option.value : undefined });
  };

  handleFormSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    this.setState({ loading: true });

    const data = new FormData(event.currentTarget);

    try {
      const { profile } = await createQualityProfile(data);

      const parentProfile = this.props.profiles.find((p) => p.key === this.state.parent);
      if (parentProfile) {
        await changeProfileParent(profile, parentProfile);
      }

      this.props.onCreate(profile);
    } finally {
      if (this.mounted) {
        this.setState({ loading: false });
      }
    }
  };

  render() {
    const header = translate('quality_profiles.new_profile');
    const languageQueryFilter = parseAsOptionalString(this.props.location.query.language);
    const languages = sortBy(this.props.languages, 'name');
    let profiles: Array<{ label: string; value: string }> = [];

    const selectedLanguage = this.state.language || languageQueryFilter || languages[0].key;
    const importers = this.state.importers.filter((importer) =>
      importer.languages.includes(selectedLanguage)
    );

    if (selectedLanguage) {
      const languageProfiles = this.props.profiles.filter((p) => p.language === selectedLanguage);
      profiles = [
        { label: translate('none'), value: '' },
        ...sortBy(languageProfiles, 'name').map((profile) => ({
          label: profile.isBuiltIn
            ? `${profile.name} (${translate('quality_profiles.built_in')})`
            : profile.name,
          value: profile.key,
        })),
      ];
    }
    const languagesOptions = languages.map((l) => ({
      label: l.name,
      value: l.key,
    }));

    const isParentProfileClearable = () => {
      if (this.state.parent !== undefined && this.state.parent !== '') {
        return true;
      }
      return false;
    };

    return (
      <Modal contentLabel={header} onRequestClose={this.props.onClose} size="small">
        <form id="create-profile-form" onSubmit={this.handleFormSubmit}>
          <div className="modal-head">
            <h2>{header}</h2>
          </div>

          {this.state.preloading ? (
            <div className="modal-body">
              <i className="spinner" />
            </div>
          ) : (
            <div className="modal-body">
              <MandatoryFieldsExplanation className="modal-field" />
              <div className="modal-field">
                <label htmlFor="create-profile-name">
                  {translate('name')}
                  <MandatoryFieldMarker />
                </label>
                <input
                  autoFocus={true}
                  id="create-profile-name"
                  maxLength={100}
                  name="name"
                  onChange={this.handleNameChange}
                  required={true}
                  size={50}
                  type="text"
                  value={this.state.name}
                />
              </div>
              <div className="modal-field">
                <label htmlFor="create-profile-language-input">
                  {translate('language')}
                  <MandatoryFieldMarker />
                </label>
                <Select
                  className="width-100"
                  autoFocus={true}
                  id="create-profile-language"
                  inputId="create-profile-language-input"
                  name="language"
                  isClearable={false}
                  onChange={this.handleLanguageChange}
                  options={languagesOptions}
                  isSearchable={true}
                  value={languagesOptions.filter((o) => o.value === selectedLanguage)}
                />
              </div>
              {selectedLanguage && profiles.length > 0 && (
                <div className="modal-field">
                  <label htmlFor="create-profile-parent-input">
                    {translate('quality_profiles.parent')}
                  </label>
                  <Select
                    className="width-100"
                    autoFocus={true}
                    id="create-profile-parent"
                    inputId="create-profile-parent-input"
                    name="parentKey"
                    isClearable={isParentProfileClearable()}
                    onChange={this.handleParentChange}
                    options={profiles}
                    isSearchable={true}
                    value={profiles.filter((o) => o.value === (this.state.parent || ''))}
                  />
                </div>
              )}
              {importers.map((importer) => (
                <div
                  className="modal-field spacer-bottom js-importer"
                  data-key={importer.key}
                  key={importer.key}
                >
                  <label htmlFor={'create-profile-form-backup-' + importer.key}>
                    {importer.name}
                  </label>
                  <input
                    id={'create-profile-form-backup-' + importer.key}
                    name={'backup_' + importer.key}
                    type="file"
                  />
                  <p className="note">
                    {translate('quality_profiles.optional_configuration_file')}
                  </p>
                </div>
              ))}
              {/* drop me when we stop supporting ie11 */}
              <input name="hello-ie11" type="hidden" value="" />
            </div>
          )}

          <div className="modal-foot">
            {this.state.loading && <i className="spinner spacer-right" />}
            {!this.state.preloading && (
              <SubmitButton disabled={this.state.loading} id="create-profile-submit">
                {translate('create')}
              </SubmitButton>
            )}
            <ResetButtonLink id="create-profile-cancel" onClick={this.props.onClose}>
              {translate('cancel')}
            </ResetButtonLink>
          </div>
        </form>
      </Modal>
    );
  }
}
