# Adds App/PrivacyInfo.xcprivacy to the App target's resources (runs on the Mac build machine, where the xcodeproj gem is available).
require 'xcodeproj'
proj = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
target = proj.targets.find { |t| t.name == 'App' }
group = proj.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' }
name = 'PrivacyInfo.xcprivacy'
if group.files.any? { |f| f.path == name }
  puts 'PrivacyInfo.xcprivacy already in the project'
else
  ref = group.new_reference(name)
  target.resources_build_phase.add_file_reference(ref)
  proj.save
  puts 'Added PrivacyInfo.xcprivacy to the App target'
end
